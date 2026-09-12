"use client";

import { useState } from "react";

/** Re-runnable button for INT-01/INT-03: subscribes this app to the WABA's webhooks and
 * points Meta's callback at this deployment. Safe to click again after a redeploy or a
 * URL change.
 */
export default function WhatsAppWebhookSetup() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/whatsapp-webhook-setup", { method: "POST" });
    const body = await res.json();
    setResult(JSON.stringify(body, null, 2));
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
      <div>
        <div className="text-sm font-medium text-slate-900">WhatsApp webhook setup</div>
        <div className="text-xs text-slate-500">
          Subscribes this app to the WABA and points Meta&apos;s webhook at this deployment. Re-run after any redeploy that changes the URL.
        </div>
      </div>
      <button onClick={run} disabled={loading} className="rounded-md bg-slate-900 text-white text-sm px-4 py-1.5 disabled:opacity-50">
        {loading ? "Configuring..." : "Configure WhatsApp webhook"}
      </button>
      {result && <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto">{result}</pre>}
    </div>
  );
}
