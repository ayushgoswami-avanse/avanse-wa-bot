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
  const [suggesting, setSuggesting] = useState(false);
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

  async function suggest() {
    setSuggesting(true);
    setError(null);
    const res = await fetch("/api/agent/suggest-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    const body = await res.json().catch(() => ({}));
    setSuggesting(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't get a suggestion");
      return;
    }
    if (body.suggestion) setText(body.suggestion);
  }

  if (!inWindow) {
    return (
      <div className="animate-slide-up bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-sm">
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
          <button onClick={send} disabled={sending || !templateName} className="rounded-md bg-brand-teal-dark text-white text-sm px-4 py-1.5 disabled:opacity-50 hover:bg-brand-deep transition-colors">
            Send
          </button>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div className="animate-slide-up bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Reply</span>
        <button
          onClick={suggest}
          disabled={suggesting}
          className="text-xs font-medium text-brand-teal-dark hover:text-brand-deep disabled:opacity-50 flex items-center gap-1 transition-colors"
        >
          {suggesting ? (
            <>
              <span className="inline-block w-3 h-3 rounded-full border-2 border-brand-teal border-t-transparent animate-spin" />
              Drafting…
            </>
          ) : (
            <>✨ Suggest reply</>
          )}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Reply to this student, or click Suggest reply…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal"
      />
      <div className="flex justify-end">
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="rounded-md bg-brand-teal-dark text-white text-sm px-4 py-1.5 disabled:opacity-50 hover:bg-brand-deep transition-colors"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
