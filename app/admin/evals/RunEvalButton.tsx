"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunEvalButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/evals/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eval run failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eval run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={running}
        className="text-sm font-medium px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? "Running 5 personas…" : "Run new eval"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
