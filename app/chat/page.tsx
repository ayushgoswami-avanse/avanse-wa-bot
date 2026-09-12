"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { OutboundPayload } from "@/lib/whatsapp/types";

type ChatEntry =
  | { id: string; direction: "INBOUND"; text: string }
  | { id: string; direction: "OUTBOUND"; payload: OutboundPayload };

function ChatWidget() {
  const searchParams = useSearchParams();
  const [waId, setWaId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickToken = searchParams.get("t") ?? undefined;
    fetch("/api/web-mirror/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clickToken }),
    })
      .then((r) => r.json())
      .then((data) => setWaId(data.waId));
  }, [searchParams]);

  useEffect(() => {
    if (!waId) return;
    const es = new EventSource(`/api/web-mirror/stream?waId=${encodeURIComponent(waId)}`);
    es.onopen = () => setConnected(true);
    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === "outbound") {
        setEntries((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, direction: "OUTBOUND", payload: data.payload }]);
      }
    };
    return () => es.close();
  }, [waId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  async function sendText(text: string) {
    if (!waId || !text.trim()) return;
    setEntries((prev) => [...prev, { id: `${Date.now()}`, direction: "INBOUND", text }]);
    setInput("");
    await fetch("/api/web-mirror/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waId, text }),
    });
  }

  async function sendReply(id: string, title: string) {
    if (!waId) return;
    setEntries((prev) => [...prev, { id: `${Date.now()}`, direction: "INBOUND", text: title }]);
    await fetch("/api/web-mirror/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waId, interactiveReplyId: id, interactiveReplyTitle: title }),
    });
  }

  return (
    <div className="min-h-screen bg-[#e5ddd5] flex items-center justify-center py-6">
      <div className="w-full max-w-md h-[85vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-200">
        <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-semibold">AV</div>
          <div>
            <div className="font-medium text-sm">Avanse SEC Counsellor</div>
            <div className="text-xs text-white/70">{connected ? "online" : "connecting…"} · web chat mirror</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#ece5dd]">
          {entries.map((entry) => (
            <Bubble key={entry.id} entry={entry} onReply={sendReply} />
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendText(input);
          }}
          className="p-3 bg-white border-t border-slate-200 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message"
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:outline-none"
          />
          <button type="submit" className="rounded-full bg-[#075e54] text-white px-4 py-2 text-sm">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function Bubble({ entry, onReply }: { entry: ChatEntry; onReply: (id: string, title: string) => void }) {
  if (entry.direction === "INBOUND") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-[#dcf8c6] rounded-lg px-3 py-2 text-sm shadow-sm">{entry.text}</div>
      </div>
    );
  }

  const p = entry.payload;
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] bg-white rounded-lg px-3 py-2 text-sm shadow-sm space-y-2">
        {p.kind === "text" && <div className="whitespace-pre-wrap">{p.body}</div>}

        {p.kind === "buttons" && (
          <>
            <div className="whitespace-pre-wrap">{p.body}</div>
            <div className="flex flex-col gap-1 pt-1">
              {p.buttons.map((b) => (
                <button key={b.id} onClick={() => onReply(b.id, b.title)} className="text-left text-[#075e54] border border-[#075e54]/30 rounded-md px-2 py-1 text-xs hover:bg-[#075e54]/5">
                  {b.title}
                </button>
              ))}
            </div>
          </>
        )}

        {p.kind === "list" && (
          <>
            <div className="whitespace-pre-wrap">{p.body}</div>
            <div className="flex flex-col gap-2 pt-1">
              {p.sections.map((s, si) => (
                <div key={si}>
                  <div className="text-[10px] uppercase text-slate-500">{s.title}</div>
                  {s.rows.map((r) => (
                    <button key={r.id} onClick={() => onReply(r.id, r.title)} className="w-full text-left text-[#075e54] border border-[#075e54]/30 rounded-md px-2 py-1 text-xs hover:bg-[#075e54]/5 mt-1">
                      {r.title}
                      {r.description && <div className="text-slate-500 text-[10px]">{r.description}</div>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {p.kind === "cta_url" && (
          <>
            <div className="whitespace-pre-wrap">{p.body}</div>
            <a href={p.url} target="_blank" rel="noreferrer" className="block text-center bg-[#075e54] text-white rounded-md px-2 py-1.5 text-xs">
              {p.buttonText}
            </a>
          </>
        )}

        {p.kind === "template" && <div className="whitespace-pre-wrap italic text-slate-500">{p.bodyParams?.join(" · ")}</div>}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatWidget />
    </Suspense>
  );
}
