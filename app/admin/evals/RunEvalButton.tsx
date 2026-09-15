"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 2000;
// Defense in depth on top of the server's own staleness check (STALE_AFTER_MS in
// lib/evals/runEval.ts) — stop polling client-side even if that check somehow doesn't
// fire, rather than spin on a dead run forever.
const MAX_POLL_MS = 8 * 60 * 1000;

type Progress = { casesCompletedSoFar: number; expectedCases: number };

export function RunEvalButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  function stopPolling() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }

  function pollRun(runId: string) {
    const startedPollingAt = Date.now();
    timerRef.current = setInterval(async () => {
      if (Date.now() - startedPollingAt > MAX_POLL_MS) {
        stopPolling();
        setError("This run is taking far longer than expected — check server logs.");
        return;
      }
      try {
        const res = await fetch(`/api/admin/evals/${runId}`, { cache: "no-store" });
        if (!res.ok) return; // transient — next tick retries
        const status = await res.json();
        setProgress({ casesCompletedSoFar: status.casesCompletedSoFar, expectedCases: status.expectedCases });
        if (status.stale) {
          stopPolling();
          setError("This run appears to have stopped partway (the server may have restarted) — check server logs.");
          router.refresh();
          return;
        }
        if (status.done) {
          stopPolling();
          router.refresh();
        }
      } catch {
        // transient network hiccup — next tick retries
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleClick() {
    setRunning(true);
    setError(null);
    setProgress(null);
    try {
      const res = await fetch("/api/admin/evals/run", { method: "POST" });
      const data = await res.json();
      if (res.status !== 202 && res.status !== 409) throw new Error(data.error ?? "Eval run failed to start");
      // 409 means another run is already in flight — watch that one instead of erroring,
      // since the admin's intent ("get me a fresh eval result") is served either way.
      pollRun(data.runId);
    } catch (err) {
      setRunning(false);
      setError(err instanceof Error ? err.message : "Eval run failed to start");
    }
  }

  const label = running
    ? progress
      ? `Running ${progress.casesCompletedSoFar}/${progress.expectedCases} personas…`
      : "Starting…"
    : "Run new eval";

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={running}
        className="text-sm font-medium px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
