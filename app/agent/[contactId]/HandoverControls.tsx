"use client";

import { useRouter } from "next/navigation";
import type { Handover } from "@prisma/client";

export default function HandoverControls({ contactId, handover }: { contactId: string; handover: Handover | null }) {
  const router = useRouter();

  async function claim() {
    await fetch("/api/agent/handover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, action: "claim" }) });
    router.refresh();
  }
  async function resolve() {
    await fetch("/api/agent/handover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, action: "resolve" }) });
    router.refresh();
  }

  if (!handover) {
    return <div className="bg-white rounded-lg border border-slate-200 p-4 text-xs text-slate-400">No open handover for this thread.</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2 text-sm">
      <div className="font-medium text-slate-900">Handover — {handover.reason.replaceAll("_", " ").toLowerCase()}</div>
      <div className="text-xs text-slate-500">Status: {handover.status}</div>
      {handover.status === "QUEUED" && (
        <button onClick={claim} className="rounded-md bg-slate-900 text-white text-xs px-3 py-1.5">
          Claim
        </button>
      )}
      {handover.status === "CLAIMED" && (
        <button onClick={resolve} className="rounded-md bg-emerald-600 text-white text-xs px-3 py-1.5">
          Mark resolved (return to AI)
        </button>
      )}
    </div>
  );
}
