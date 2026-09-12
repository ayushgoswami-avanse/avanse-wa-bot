"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** FR-H03 — reuses the exact same send governor as the AI counsellor (FR-G02): identical
 * window, template and cap rules apply to an agent's manual send.
 */
export default function SendBox({
  contactId,
  inWindow,
  templates,
}: {
  contactId: string;
  inWindow: boolean;
  templates: { name: string; category: string }[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    const res = await fetch("/api/agent/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inWindow ? { contactId, text } : { contactId, templateName }),
    });
    setSending(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.reason ?? body.error ?? "Send failed");
      return;
    }
    setText("");
    router.refresh();
  }

  if (!inWindow) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
        <div className="text-xs text-amber-600">Outside the 24h service window — only an approved template may be sent (FR-G01/G03).</div>
        <div className="flex gap-2">
          <select value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Choose a template…</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
          <button onClick={send} disabled={sending || !templateName} className="rounded-md bg-slate-900 text-white text-sm px-4 py-1.5 disabled:opacity-50">
            Send
          </button>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Reply to this student…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none"
      />
      <div className="flex justify-end">
        <button onClick={send} disabled={sending || !text.trim()} className="rounded-md bg-slate-900 text-white text-sm px-4 py-1.5 disabled:opacity-50">
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
