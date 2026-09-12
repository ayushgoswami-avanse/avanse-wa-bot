"use client";

import { useState } from "react";
import type { ConfigKey } from "@/lib/config";

const FIELDS: { key: ConfigKey; label: string; type: "toggle" | "select" | "number" | "text"; options?: string[]; note?: string }[] = [
  { key: "FEATURE_TIER1_ELIGIBILITY_ENABLED", label: "Tier 1 eligibility enabled", type: "toggle", note: "FR-E04 — the required fallback if the Compliance opinion is unfavourable." },
  { key: "REDIRECT_FAILOVER_TARGET", label: "Redirect failover target", type: "select", options: ["whatsapp", "web_mirror"], note: "FR-A10 — repoint every QR without reprinting." },
  { key: "QUALITY_RATING", label: "Simulated WhatsApp quality rating", type: "select", options: ["high", "medium", "low"], note: "FR-G05 — Low auto-pauses all marketing sends." },
  { key: "DEBOUNCE_WINDOW_MS", label: "Debounce window (ms)", type: "number" },
  { key: "ATTRIBUTION_RECOVERY_WINDOW_MINUTES", label: "Attribution recovery window (minutes)", type: "number" },
  { key: "SESSION_GAP_MINUTES", label: "New session after (minutes of silence)", type: "number", note: "Drives the interaction-session boundary on the Leads page." },
  { key: "MARKETING_TEMPLATES_PER_CONTACT_FORTNIGHT", label: "Marketing sends / contact / fortnight", type: "number" },
  { key: "DAILY_SPEND_CEILING_INR", label: "Daily messaging spend ceiling (₹)", type: "number" },
  { key: "MONTHLY_SPEND_CEILING_INR", label: "Monthly messaging spend ceiling (₹)", type: "number" },
  { key: "SEMANTIC_CACHE_TTL_MINUTES", label: "Semantic cache TTL (minutes)", type: "number" },
  { key: "PROPENSITY_SYNC_GATE_MIN_BAND", label: "Minimum propensity band synced to Processio", type: "select", options: ["LOW", "MEDIUM", "HIGH"] },
  { key: "GROUNDING_ALWAYS_ALLOW_TOPICS", label: "Always-ground topics (comma-separated)", type: "text", note: "FR-D04" },
];

export default function SettingsForm({ config }: { config: Record<ConfigKey, string> }) {
  const [values, setValues] = useState(config);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(key: ConfigKey, value: string) {
    setSaving(key);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setSaving(null);
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
      {FIELDS.map((f) => (
        <div key={f.key} className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900">{f.label}</div>
            {f.note && <div className="text-xs text-slate-400">{f.note}</div>}
          </div>
          <div className="flex items-center gap-2">
            {f.type === "toggle" && (
              <select
                value={values[f.key]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [f.key]: e.target.value }));
                  save(f.key, e.target.value);
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            )}
            {f.type === "select" && (
              <select
                value={values[f.key]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [f.key]: e.target.value }));
                  save(f.key, e.target.value);
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                {f.options!.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
            {(f.type === "number" || f.type === "text") && (
              <input
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                onBlur={(e) => save(f.key, e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm w-64"
              />
            )}
            {saving === f.key && <span className="text-xs text-slate-400">saving…</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
