"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin-only. Two-step confirm (no native confirm() dialog, to match the rest of the
 * console's design) — click once to arm, click again within a few seconds to actually
 * delete. The API cascades to every related row (messages, sessions, handovers,
 * dispositions, notes, etc.) at the DB level.
 */
export default function DeleteLeadButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    const res = await fetch(`/api/admin/leads/${contactId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/leads");
      router.refresh();
    } else {
      setDeleting(false);
      setArmed(false);
    }
  }

  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
      >
        Delete lead
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-red-700">Delete this lead and all its data?</span>
      <button
        onClick={confirmDelete}
        disabled={deleting}
        className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        onClick={() => setArmed(false)}
        disabled={deleting}
        className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1.5"
      >
        Cancel
      </button>
    </div>
  );
}
