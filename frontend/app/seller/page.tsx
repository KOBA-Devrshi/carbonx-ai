"use client";
import { useState, ChangeEvent, FormEvent } from "react";

interface SellerFormState {
  projectName: string;
  developer: string;
  location: string;
  methodology: string;
  projectType: string;
  volume: number;
  baselineEmissions: number;
  registryStandard: string;
}

export default function SellerPortalPage() {
  const [form, setForm] = useState<SellerFormState>({
    projectName: "",
    developer: "",
    location: "",
    methodology: "VM0007 (REDD+ / Avoided Deforestation)",
    projectType: "Reforestation",
    volume: 5000,
    baselineEmissions: 12000,
    registryStandard: "Verra (VCS)",
  });

  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "volume" || name === "baselineEmissions" ? Number(value) : value,
    }));
  };

  async function handleListingSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!evidenceFile) {
      setError("Error: Initial verification evidence document or satellite baseline proof is mandatory to list.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      setTimeout(() => {
        setSuccessMessage(`Success! Project "${form.projectName}" successfully registered and queued for AI vs. AI audit validation.`);
        setSubmitting(false);
        setForm({
          projectName: "",
          developer: "",
          location: "",
          methodology: "VM0007 (REDD+ / Avoided Deforestation)",
          projectType: "Reforestation",
          volume: 5000,
          baselineEmissions: 12000,
          registryStandard: "Verra (VCS)",
        });
        setEvidenceFile(null);
      }, 1500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to list property.";
      setError(errorMessage);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-sans">Seller & Project Developer Portal</h1>
        <p className="text-textDim text-[13px] mt-1">
          Tokenize and list verified carbon assets. All properties are cryptographically anchored to Carbon DNA upon submission.
        </p>
      </div>

      <div className="card border border-border bg-surface p-6">
        <form onSubmit={handleListingSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="field">
              <label className="text-[13px] font-medium text-textDim">Project Name</label>
              <input 
                type="text" 
                name="projectName" 
                value={form.projectName} 
                onChange={handleChange} 
                placeholder="e.g., Western Ghats Bio-Corridor" 
                className="w-full bg-surface2 border border-border p-2.5 rounded-lg text-[13px]"
                required 
              />
            </div>

            <div className="field">
              <label className="text-[13px] font-medium text-textDim">Project Developer / Entity</label>
              <input 
                type="text" 
                name="developer" 
                value={form.developer} 
                onChange={handleChange} 
                placeholder="e.g., EcoGuardians India Ltd." 
                className="w-full bg-surface2 border border-border p-2.5 rounded-lg text-[13px]"
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="field">
              <label className="text-[13px] font-medium text-textDim">Geographic Location</label>
              <input 
                type="text" 
                name="location" 
                value={form.location} 
                onChange={handleChange} 
                placeholder="e.g., Maharashtra, India" 
                className="w-full bg-surface2 border border-border p-2.5 rounded-lg text-[13px]"
                required 
              />
            </div>

            <div className="field">
              <label className="text-[13px] font-medium text-textDim">Registry Standard</label>
              <select 
                name="registryStandard" 
                value={form.registryStandard} 
                onChange={handleChange}
                className="w-full bg-surface2 border border-border p-2.5 rounded-lg text-[13px]"
              >
                <option>Verra (VCS)</option>
                <option>Gold Standard</option>
                <option>Climate Action Reserve (CAR)</option>
                <option>American Carbon Registry (ACR)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="field">
              <label className="text-[13px] font-medium text-textDim">Approved Methodology</label>
              <select 
                name="methodology" 
                value={form.methodology} 
                onChange={handleChange}
                className="w-full bg-surface2 border border-border p-2.5 rounded-lg text-[13px]"
              >
                <option>VM0007 (REDD+ / Avoided Deforestation)</option>
                <option>ACM0002 (Grid-connected electricity generation from renewables)</option>
                <option>AMS-I.D. (Renewable electricity generation)</option>
                <option>VM0042 (Improved Agricultural Land Management)</option>
              </select>
            </div>

            <div className="field">
              <label className="text-[13px] font-medium text-textDim">Project Type</label>
              <select 
                name="projectType" 
                value={form.projectType} 
                onChange={handleChange}
                className="w-full bg-surface2 border border-border p-2.5 rounded-lg text-[13px]"
              >
                <option>Reforestation</option>
                <option>Renewable Energy</option>
                <option>Direct Air Capture</option>
                <option>Blue Carbon / Peatland</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="field">
              <label className="text-[13px] font-medium text-textDim">Issuance Volume (tCO2e)</label>
              <input 
                type="number" 
                name="volume" 
                value={form.volume} 
                onChange={handleChange} 
                className="w-full bg-surface2 border border-border p-2.5 rounded-lg text-[13px]"
                required 
              />
            </div>

            <div className="field">
              <label className="text-[13px] font-medium text-textDim">Baseline Emissions (tCO2e/yr)</label>
              <input 
                type="number" 
                name="baselineEmissions" 
                value={form.baselineEmissions} 
                onChange={handleChange} 
                className="w-full bg-surface2 border border-border p-2.5 rounded-lg text-[13px]"
                required 
              />
            </div>
          </div>

          <div className="field pt-2">
            <label className="text-[13px] font-medium text-textDim">Upload Mandatory Baseline Proof & Verification Audit (PDF)</label>
            <input 
              type="file" 
              accept=".pdf,image/*" 
              onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              className="w-full border border-border bg-surface2 p-2.5 rounded-lg text-[12.5px]"
              required
            />
            <span className="text-[11.5px] text-textFaint mt-1 block">
              Required properties: GIS shapefiles, independent auditor validation report, and monitoring logs.
            </span>
          </div>

          {error && <div className="text-danger text-[12.5px] font-mono">{error}</div>}
          {successMessage && <div className="text-accent text-[12.5px] font-mono">{successMessage}</div>}

          <div className="pt-4 border-t border-border flex justify-end">
            <button 
              type="submit" 
              disabled={submitting} 
              className="btn btn-primary px-6 py-2.5 disabled:opacity-50"
            >
              {submitting ? "Anchoring Carbon DNA..." : "Submit Project & Generate Carbon DNA"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}