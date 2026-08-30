"""
Seeds five demo projects (clearly synthetic — DEMO DATA, not certified
carbon credits) and runs the real pipeline (evidence -> audit -> risk ->
DNA) on each so the dashboard/marketplace are populated with genuine
computed values, not hardcoded numbers.

Run: python seed.py
"""
from datetime import datetime, timedelta

from database.session import Base, engine, SessionLocal
from models.models import (
    Project, Credit, Evidence, VerificationStatus, Audit, AuditFinding,
)
from services import ai_audit, carbon_dna
from services.trust_service import recompute_trust_and_persist, log_action

Base.metadata.create_all(bind=engine)

PROJECTS = [
    dict(name="Solar Farm India — Ratnagiri", project_type="Solar", developer="Konkan Renewables Pvt Ltd",
         location="Ratnagiri, Maharashtra, IN", methodology="AMS-I.D (Grid-connected renewable electricity)",
         baseline_emissions=14200, reported_emissions=9700, production_baseline=100000, production_reported=92000,
         volume=4300, price=18.50,
         evidence=[("Electricity Invoice", "MSEDCL Utility Portal", 88), ("Meter Reading Log", "IoT Smart Meter", 84),
                    ("Production Register", "Plant ERP Export", 79), ("Site Photographs", "Field Survey", 70)]),
    dict(name="Reforestation Maharashtra — Konkan Belt", project_type="Forestry", developer="Sahyadri Green Trust",
         location="Sindhudurg, Maharashtra, IN", methodology="AR-ACM0003 (Afforestation/Reforestation)",
         baseline_emissions=6000, reported_emissions=2700, production_baseline=1, production_reported=1,
         volume=3200, price=12.80,
         evidence=[("Planting Survey", "Field Team", 55), ("Satellite NDVI Snapshot", "Remote Sensing Provider", 48)]),
    dict(name="Wind Energy Gujarat — Kutch Corridor", project_type="Wind", developer="Gujarat Wind Power Ltd",
         location="Kutch, Gujarat, IN", methodology="ACM0002 (Grid-connected renewable electricity)",
         baseline_emissions=21000, reported_emissions=20200, production_baseline=150000, production_reported=166000,
         volume=6800, price=21.00,
         evidence=[("Electricity Invoice", "GUVNL Portal", 95), ("SCADA Turbine Log", "Turbine Telemetry", 92),
                    ("Production Register", "SCADA Export", 91), ("Third-Party Verification Report", "Independent Auditor", 96),
                    ("Site Photographs", "Field Survey", 88)]),
    dict(name="Biogas Karnataka — Mysuru Dairy Cluster", project_type="Biogas", developer="Karnataka Clean Energy Co-op",
         location="Mysuru, Karnataka, IN", methodology="AMS-III.D (Methane recovery, biogas)",
         baseline_emissions=8600, reported_emissions=5100, production_baseline=42000, production_reported=40500,
         volume=3100, price=15.40,
         evidence=[("Gas Flow Meter Log", "SCADA", 74), ("Site Inspection Report", "Third-Party Verifier", 78),
                    ("Household Survey", "Field NGO Partner", 66)]),
    dict(name="Industrial Energy Efficiency — Nagpur Textiles", project_type="Efficiency", developer="Vidarbha Industrial Energy Co",
         location="Nagpur, Maharashtra, IN", methodology="AMS-II.D (Energy efficiency, industrial)",
         baseline_emissions=11200, reported_emissions=6700, production_baseline=58000, production_reported=55200,
         volume=4500, price=14.20,
         evidence=[("Electricity Invoice", "Utility Portal", 58), ("Production Register", "Plant ERP Export", 52)]),
]


def run():
    db = SessionLocal()
    try:
        if db.query(Project).count() > 0:
            print("Database already seeded — skipping. Delete carbonx.db to reseed.")
            return

        created_credits = []
        for p in PROJECTS:
            project = Project(
                name=p["name"], project_type=p["project_type"], developer=p["developer"],
                location=p["location"], methodology=p["methodology"], demo_data=True,
            )
            db.add(project)
            db.flush()

            credit = Credit(
                project_id=project.id,
                reporting_period="Jan-Jun 2026",
                baseline_emissions=p["baseline_emissions"], reported_emissions=p["reported_emissions"],
                production_baseline=p["production_baseline"], production_reported=p["production_reported"],
                volume_tco2e=p["volume"], available_tco2e=p["volume"], market_price=p["price"],
                verification_status=VerificationStatus.PENDING,
                issued_at=datetime.utcnow() - timedelta(days=20),
                last_validated_at=datetime.utcnow() - timedelta(days=20),
                next_review_at=datetime.utcnow() + timedelta(days=160),
            )
            db.add(credit)
            db.flush()

            for etype, source, q in p["evidence"]:
                db.add(Evidence(credit_id=credit.id, evidence_type=etype, source=source, quality_score=q))
            db.commit()
            db.refresh(credit)
            created_credits.append(credit)

        # Run the real audit pipeline on every seeded credit (all-at-once so
        # the IsolationForest anomaly model has a real portfolio to fit against).
        for credit in created_credits:
            all_credits = db.query(Credit).all()
            result = ai_audit.run_audit(credit, all_credits)
            audit = Audit(
                credit_id=credit.id, defender_score=result["defender_score"],
                auditor_challenges=len(result["findings"]), confidence_score=result["confidence_score"],
                risk_level=result["risk_level"], recommendation=result["recommendation"],
                defender_statement=result["defender_statement"], auditor_statement=result["auditor_statement"],
                anomaly_score=result["anomaly_score"],
            )
            db.add(audit)
            db.commit()
            db.refresh(audit)
            for f in result["findings"]:
                db.add(AuditFinding(audit_id=audit.id, **f))
            db.commit()

            recompute_trust_and_persist(db, credit)

            fingerprint, _ = carbon_dna.compute_fingerprint(credit)
            credit.dna_fingerprint = fingerprint
            credit.dna_verified_at = datetime.utcnow()
            credit.verification_status = (
                VerificationStatus.CARBONX_VERIFIED if result["recommendation"] == "APPROVE"
                else VerificationStatus.UNDER_REVIEW
            )
            db.add(credit)
            db.commit()

            log_action(db, "System", "Demo Seed", credit.id,
                       f"Seeded with real audit — {result['recommendation']}")

        print(f"Seeded {len(created_credits)} demo projects/credits with real audits, risk scores and DNA fingerprints.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
