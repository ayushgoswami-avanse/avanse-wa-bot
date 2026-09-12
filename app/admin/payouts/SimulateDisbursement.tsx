"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Ambassador } from "@prisma/client";

/** No real disbursement pipeline exists in this POC (that requires an actual loan to
 * fund). This lets you demonstrate the payout reconciliation/review/clawback workflow
 * against a real contact's real attribution tier without waiting for one.
 */
export default function SimulateDisbursement({ ambassadors }: { ambassadors: Ambassador[] }) {
  const router = useRouter();
  const [waId, setWaId] = useState("");
  const [ambassadorId, setAmbassadorId] = useState(ambassadors[0]?.id ?? "");
  const [amount, setAmount] = useState("2000");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waId, ambassadorId, amount: Number(amount) }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed");
      return;
    }
    setWaId("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Contact wa_id</label>
        <input required value={waId} onChange={(e) => setWaId(e.target.value)} placeholder="9198…" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Ambassador</label>
        <select value={ambassadorId} onChange={(e) => setAmbassadorId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          {ambassadors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm w-28" />
      </div>
      <button disabled={loading} className="rounded-md bg-slate-900 text-white text-sm px-4 py-1.5 hover:bg-slate-800 disabled:opacity-50">
        {loading ? "Recording..." : "Simulate disbursement"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
