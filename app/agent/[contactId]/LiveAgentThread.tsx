"use client";

import { useEffect, useRef } from "react";
import type { Message, Handover } from "@prisma/client";
import ConversationView from "@/components/ConversationView";
import DispositionPanel, { type NoteEntry } from "@/components/DispositionPanel";
import { useLiveThread, type ThreadMeta } from "@/components/useLiveThread";
import SendBox from "./SendBox";
import HandoverControls from "./HandoverControls";

export default function LiveAgentThread({
  contactId,
  initialMessages,
  initialHandover,
  initialInWindow,
  initialMeta,
  showFinancials,
  templates,
  currentDisposition,
  initialNotes,
}: {
  contactId: string;
  initialMessages: Message[];
  initialHandover: Handover | null;
  initialInWindow: boolean;
  initialMeta: ThreadMeta;
  showFinancials: boolean;
  templates: { name: string; category: string }[];
  currentDisposition: string;
  initialNotes: NoteEntry[];
}) {
  const { messages, handover, inWindow, contact, refresh } = useLiveThread(contactId, {
    messages: initialMessages,
    handover: initialHandover,
    inWindow: initialInWindow,
    contact: initialMeta,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(messages.length);

  useEffect(() => {
    if (messages.length !== lastCount.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      lastCount.current = messages.length;
    }
  }, [messages.length]);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-3">
        <div
          ref={scrollRef}
          className="animate-fade-in bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 p-5 h-[58vh] overflow-y-auto brand-scroll shadow-sm"
        >
          <ConversationView messages={messages} />
        </div>
        <SendBox contactId={contactId} inWindow={inWindow} templates={templates} onSent={refresh} />
      </div>

      <div className="space-y-4">
        <div className="animate-slide-up stagger-1 bg-white rounded-2xl border border-slate-200 p-4 text-sm space-y-2.5 shadow-sm">
          <div className="font-semibold text-slate-900 font-mono text-xs pb-1 border-b border-slate-100">{contact.waId}</div>
          <Row label="Journey" value={contact.journey ?? "—"} />
          <Row label="Stage" value={contact.stage.replaceAll("_", " ").toLowerCase()} />
          <Row label="Window" value={inWindow ? "In window (free-form OK)" : "Closed (template only)"} highlight={!inWindow} />
          <Row label="Attribution" value={contact.attributionTier ?? "—"} />
          <Row label="Propensity" value={contact.propensityBand ?? "—"} />
          {showFinancials ? (
            <Row label="Destination/course" value={contact.destinationCountry ?? contact.courseCategory ?? "—"} />
          ) : (
            <div className="text-xs text-slate-500 italic">Course/financial detail masked for your role</div>
          )}
        </div>

        <div className="animate-slide-up stagger-2">
          <HandoverControls contactId={contactId} handover={handover} onAction={refresh} />
        </div>

        <div className="animate-slide-up stagger-3">
          <DispositionPanel contactId={contactId} currentDisposition={currentDisposition} initialNotes={initialNotes} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium capitalize text-right ${highlight ? "text-amber-600" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}
