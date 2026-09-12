"use client";

import { useRouter } from "next/navigation";

export default function PayoutActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  async function act(action: "approve" | "hold" | "clawback") {
    await fetch(`/api/admin/payouts/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  if (status === "PAID" || status === "CLAWED_BACK") return <span className="text-xs text-slate-400">—</span>;

  return (
    <div className="flex gap-2 text-xs">
      {status !== "APPROVED" && (
        <button onClick={() => act("approve")} className="text-emerald-600 hover:underline">
          Approve
        </button>
      )}
      {status !== "HELD" && (
        <button onClick={() => act("hold")} className="text-amber-600 hover:underline">
          Hold
        </button>
      )}
      <button onClick={() => act("clawback")} className="text-red-600 hover:underline">
        Clawback
      </button>
    </div>
  );
}
