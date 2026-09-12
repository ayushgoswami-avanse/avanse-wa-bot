"use client";

import { useState } from "react";

/** FR-H03 — reuses the exact same send governor as the AI counsellor (FR-G02): identical
 * window, template and cap rules apply to an agent's manual send.
 */
export default function SendBox({
  contactId,
  inWindow,
  templates,
  onSent,
}: {
  contactId: string;
  inWindow: boolean;
  templates: { name: string; category: string }[];
  onSent?: () => void;
}) {
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
    setTemplateName("");
    onSent?.();
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
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span>⏱</span> Outside the 24h service window — only an approved template may be sent.
        </div>
        <div className="flex gap-2">
          <select
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal"
          >
            <option value="">Choose a template…</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
          <button
            onClick={send}
            disabled={sending || !templateName}
            className="rounded-xl bg-brand-teal-dark text-white text-sm font-medium px-5 py-2.5 disabled:opacity-40 hover:bg-brand-deep transition-colors shadow-sm"
          >
            Send
          </button>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim() && !sending) send();
            }
          }}
          rows={2}
          placeholder="Reply to this student…"
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14.5px] text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal focus:bg-white transition-colors"
        />
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={suggest}
            disabled={suggesting}
            title="Draft a suggested reply with AI"
            className="w-10 h-10 rounded-xl bg-brand-teal-50 text-brand-teal-dark hover:bg-brand-teal-100 disabled:opacity-50 flex items-center justify-center transition-colors text-base"
          >
            {suggesting ? <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-brand-teal-dark border-t-transparent animate-spin" /> : "✨"}
          </button>
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="w-10 h-10 rounded-xl bg-brand-teal-dark text-white disabled:opacity-40 hover:bg-brand-deep transition-colors flex items-center justify-center shadow-sm"
            title="Send (Enter)"
          >
            {sending ? <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" /> : "➤"}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5 px-1">
        <span className="text-[11px] text-slate-500">Enter to send · Shift+Enter for a new line</span>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    </div>
  );
}
