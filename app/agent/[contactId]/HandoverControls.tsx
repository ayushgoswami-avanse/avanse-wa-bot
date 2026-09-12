"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Handover } from "@prisma/client";

export default function HandoverControls({ contactId, handover }: { contactId: string; handover: Handover | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function act(action: "claim" | "resolve") {
    setLoading(true);
    await fetch("/api/agent/handover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, action }) });
    setLoading(false);
    router.refresh();
  }

  if (!handover) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-400 shadow-sm">No open handover for this thread.</div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-red-200 p-4 space-y-2 text-sm shadow-sm relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <div className="font-medium text-slate-900">Handover — {handover.reason.replaceAll("_", " ").toLowerCase()}</div>
      </div>
      <div className="text-xs text-slate-500">Status: {handover.status}</div>
      {handover.status === "QUEUED" && (
        <button
          onClick={() => act("claim")}
          disabled={loading}
          className="rounded-md bg-slate-900 text-white text-xs px-3 py-1.5 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {loading ? "Claiming…" : "Claim"}
        </button>
      )}
      {handover.status === "CLAIMED" && (
        <button
          onClick={() => act("resolve")}
          disabled={loading}
          className="rounded-md bg-brand-teal-dark text-white text-xs px-3 py-1.5 hover:bg-brand-deep transition-colors disabled:opacity-50"
        >
          {loading ? "Resolving…" : "Mark resolved (return to AI)"}
        </button>
      )}
    </div>
  );
}
