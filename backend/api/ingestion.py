import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database.session import get_db
from models.models import Project, Credit, Evidence, VerificationStatus
from services import carbon_dna, ai_audit
from services.trust_service import recompute_trust_and_persist, log_action

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])

REQUIRED_COLUMNS = {
    "project_type", "location", "baseline_emissions", "reported_emissions",
    "production", "evidence_score", "credit_volume", "market_price",
}


@router.post("/csv")
def ingest_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file")

    raw = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))
    if reader.fieldnames is None:
        raise HTTPException(400, "CSV appears to be empty")

    missing_cols = REQUIRED_COLUMNS - set(c.strip() for c in reader.fieldnames)
    if missing_cols:
        raise HTTPException(400, f"CSV is missing required columns: {sorted(missing_cols)}")

    created = []
    row_errors = []

    for i, row in enumerate(reader, start=2):
        try:
            project_name = row.get("project_name") or f"Imported Project {row.get('project_id', i)}"
            project_type = row["project_type"].strip()
            location = row["location"].strip()
            baseline = float(row["baseline_emissions"])
            reported = float(row["reported_emissions"])
            production = float(row["production"])
            evidence_score = float(row.get("evidence_score") or 70)
            volume = float(row["credit_volume"])
            price = float(row["market_price"])

            if baseline < 0 or reported < 0 or production < 0 or volume < 0 or price < 0:
                row_errors.append(f"Row {i}: negative values are not allowed")
                continue
            if reported > baseline:
                row_errors.append(f"Row {i}: reported emissions exceed baseline — flagged for audit, not rejected")

            project = Project(
                name=project_name, project_type=project_type, developer="CSV Import",
                location=location, methodology="Imported — methodology not specified", demo_data=True,
            )
            db.add(project)
            db.flush()

            credit = Credit(
                project_id=project.id,
                reporting_period=row.get("monitoring_date") or "Imported period",
                baseline_emissions=baseline, reported_emissions=reported,
                production_baseline=production, production_reported=production,
                volume_tco2e=volume, available_tco2e=volume, market_price=price,
                verification_status=VerificationStatus.PENDING,
            )
            db.add(credit)
            db.flush()

            db.add(Evidence(credit_id=credit.id, evidence_type="CSV Activity Data",
                             source=file.filename, quality_score=evidence_score))
            db.commit()
            db.refresh(credit)

            all_credits = db.query(Credit).all()
            audit_result = ai_audit.run_audit(credit, all_credits)
            from models.models import Audit, AuditFinding
            audit = Audit(
                credit_id=credit.id, defender_score=audit_result["defender_score"],
                auditor_challenges=len(audit_result["findings"]), confidence_score=audit_result["confidence_score"],
                risk_level=audit_result["risk_level"], recommendation=audit_result["recommendation"],
                defender_statement=audit_result["defender_statement"], auditor_statement=audit_result["auditor_statement"],
                anomaly_score=audit_result["anomaly_score"],
                narrative_source=audit_result.get("narrative_source", "deterministic"),
            )
            db.add(audit)
            db.commit()
            db.refresh(audit)
            for f in audit_result["findings"]:
                db.add(AuditFinding(audit_id=audit.id, **f))
            db.commit()

            recompute_trust_and_persist(db, credit)

            fingerprint, _ = carbon_dna.compute_fingerprint(credit)
            credit.dna_fingerprint = fingerprint
            credit.dna_verified_at = datetime.utcnow()
            db.add(credit)
            db.commit()
            db.refresh(credit)

            created.append({
                "credit_id": credit.id, "project_name": project.name, "trust_score": credit.trust_score,
                "risk_level": credit.risk_level.value if hasattr(credit.risk_level, "value") else credit.risk_level,
                "audit_recommendation": audit_result["recommendation"],
                "findings": len(audit_result["findings"]),
            })
        except (KeyError, ValueError) as e:
            row_errors.append(f"Row {i}: {e}")

    log_action(db, "User", "CSV Ingestion", file.filename,
               f"{len(created)} credit(s) created, {len(row_errors)} row error(s)")

    return {"created": created, "row_errors": row_errors, "total_rows_processed": len(created) + len(row_errors)}
