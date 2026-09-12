"use client";

import { useState } from "react";

const DISPOSITION_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "INTERESTED", label: "Interested" },
  { value: "HOT_FOLLOW_UP", label: "Hot follow-up" },
  { value: "CALLBACK_REQUESTED", label: "Callback requested" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "CONVERTED", label: "Converted" },
  { value: "DO_NOT_CONTACT", label: "Do not contact" },
  { value: "INVALID_CONTACT", label: "Invalid contact" },
  { value: "DUPLICATE", label: "Duplicate" },
];

export type NoteEntry = { id: string; body: string; createdAt: string; agentName: string };

export default function DispositionPanel({
  contactId,
  currentDisposition,
  initialNotes,
}: {
  contactId: string;
  currentDisposition: string;
  initialNotes: NoteEntry[];
}) {
  const [disposition, setDisposition] = useState(currentDisposition);
  const [dispositionNote, setDispositionNote] = useState("");
  const [savingDisposition, setSavingDisposition] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [notes, setNotes] = useState(initialNotes);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function saveDisposition() {
    setSavingDisposition(true);
    const res = await fetch("/api/agent/disposition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, disposition, note: dispositionNote.trim() || undefined }),
    });
    setSavingDisposition(false);
    if (res.ok) {
      setDispositionNote("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    }
  }

  async function addNote() {
    if (!noteDraft.trim()) return;
    setSavingNote(true);
    const res = await fetch("/api/agent/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, body: noteDraft }),
    });
    setSavingNote(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.note) {
      setNotes((prev) => [data.note, ...prev]);
      setNoteDraft("");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Disposition</div>
        <select
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal"
        >
          {DISPOSITION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <textarea
          value={dispositionNote}
          onChange={(e) => setDispositionNote(e.target.value)}
          placeholder="Optional reason for this disposition…"
          rows={2}
          className="w-full mt-2 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal focus:bg-white transition-colors"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={saveDisposition}
            disabled={savingDisposition || (disposition === currentDisposition && !dispositionNote.trim())}
            className="rounded-xl bg-brand-teal-dark text-white text-xs font-medium px-4 py-2 disabled:opacity-40 hover:bg-brand-deep transition-colors"
          >
            {savingDisposition ? "Saving…" : "Save disposition"}
          </button>
          {savedFlash && <span className="text-xs text-emerald-600">Saved ✓</span>}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3.5">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</div>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Add a note for yourself or a colleague working this lead…"
          rows={2}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal focus:bg-white transition-colors"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={addNote}
            disabled={savingNote || !noteDraft.trim()}
            className="rounded-xl bg-slate-900 text-white text-xs font-medium px-4 py-2 disabled:opacity-40 hover:bg-slate-800 transition-colors"
          >
            {savingNote ? "Adding…" : "Add note"}
          </button>
        </div>

        {notes.length > 0 && (
          <div className="space-y-2.5 mt-3 max-h-56 overflow-y-auto brand-scroll pr-1">
            {notes.map((n) => (
              <div key={n.id} className="text-xs bg-amber-50/60 border border-amber-100 rounded-lg p-2.5">
                <div className="text-slate-700 whitespace-pre-wrap">{n.body}</div>
                <div className="text-[10.5px] text-slate-400 mt-1">
                  {n.agentName} · {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
