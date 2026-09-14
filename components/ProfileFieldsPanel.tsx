"use client";

import { useState } from "react";

export type ProfileFieldValues = {
  confirmedName: string;
  journey: string;
  destinationCountry: string;
  degreeLevel: string;
  intendedIntake: string;
  currentYearOfStudy: string;
  testStatus: string;
  admissionStatus: string;
  courseCategory: string;
  targetInstitution: string;
  intakeOrBatch: string;
  employmentStatus: string;
  entranceStatus: string;
};

type FieldSpec = { key: keyof ProfileFieldValues; label: string; options?: string[] };

const FIELDS: FieldSpec[] = [
  { key: "confirmedName", label: "Name" },
  { key: "journey", label: "Journey", options: ["INTERNATIONAL", "DOMESTIC", "UNDECIDED"] },
  { key: "destinationCountry", label: "Destination", options: ["USA", "UK", "Canada", "Germany", "Australia", "Ireland", "Other"] },
  { key: "degreeLevel", label: "Degree level", options: ["Masters", "Bachelors", "PhD", "Other"] },
  { key: "intendedIntake", label: "Intended intake", options: ["Fall 2026", "Spring 2027", "Fall 2027", "Not sure yet"] },
  { key: "currentYearOfStudy", label: "Current year", options: ["2nd year", "3rd year", "4th / final year", "Graduated"] },
  { key: "testStatus", label: "Test status", options: ["Not started", "Preparing", "Given — GRE", "Given — GMAT", "Given — IELTS/TOEFL"] },
  { key: "admissionStatus", label: "Admission status", options: ["Not applied", "Applied", "Admitted", "Admitted with funding"] },
  { key: "courseCategory", label: "Course category (domestic)", options: ["PG", "Skilling", "Professional"] },
  { key: "targetInstitution", label: "Target institute (domestic)" },
  { key: "intakeOrBatch", label: "Intake/batch (domestic)", options: ["Immediately", "Within 3 months", "Within 6 months", "Next year"] },
  { key: "employmentStatus", label: "Employment (domestic)", options: ["Student", "Working professional"] },
  { key: "entranceStatus", label: "Entrance status (domestic)", options: ["Not applicable", "Preparing", "Appeared", "Result awaited", "Selected"] },
];

/** Fills the exact same Contact columns Guru writes via save_student_profile — for the
 * counsellor-on-a-phone-call case, where the student gives details out loud rather than
 * typing them. Only changed fields are sent; leaving a dropdown on "— not set —" never
 * overwrites something already captured.
 */
export default function ProfileFieldsPanel({ contactId, initial }: { contactId: string; initial: ProfileFieldValues }) {
  const [values, setValues] = useState<ProfileFieldValues>(initial);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = FIELDS.some((f) => values[f.key] !== initial[f.key] && values[f.key] !== "");

  async function save() {
    const updates: Record<string, string> = {};
    for (const f of FIELDS) {
      if (values[f.key] && values[f.key] !== initial[f.key]) updates[f.key] = values[f.key];
    }
    if (Object.keys(updates).length === 0) return;

    setSaving(true);
    setError(null);
    const res = await fetch("/api/agent/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, updates }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save — try again.");
      return;
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Update profile</div>
        <span className="text-[10px] text-slate-400">Fill gaps from a phone call</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="text-[11px] text-slate-500 space-y-0.5">
            {f.label}
            {f.options ? (
              <select
                value={values[f.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal"
              >
                <option value="">— not set —</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={values[f.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder="— not set —"
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal"
              />
            )}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-xl bg-brand-teal-dark text-white text-xs font-medium px-4 py-2 disabled:opacity-40 hover:bg-brand-deep transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedFlash && <span className="text-xs text-emerald-600">Saved ✓</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
