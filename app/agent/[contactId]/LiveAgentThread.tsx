"use client";

import { useEffect, useRef } from "react";
import type { Message, Handover } from "@prisma/client";
import ConversationView from "@/components/ConversationView";
import DispositionPanel, { type NoteEntry } from "@/components/DispositionPanel";
import ProfileFieldsPanel, { type ProfileFieldValues } from "@/components/ProfileFieldsPanel";
import { useLiveThread, type ThreadMeta } from "@/components/useLiveThread";
import SendBox from "./SendBox";
import HandoverControls from "./HandoverControls";

export default function LiveAgentThread({
  contactId,
  initialMessages,
  initialHandover,
  initialInWindow,
  initialMeta,
  templates,
  currentDisposition,
  initialNotes,
  profileFields,
}: {
  contactId: string;
  initialMessages: Message[];
  initialHandover: Handover | null;
  initialInWindow: boolean;
  initialMeta: ThreadMeta;
  templates: { name: string; category: string }[];
  currentDisposition: string;
  initialNotes: NoteEntry[];
  profileFields: ProfileFieldValues;
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
        {!inWindow && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Service window closed — only an approved template can be sent until {contact.waId} messages in again.
          </div>
        )}

        <div className="animate-slide-up stagger-1">
          <HandoverControls contactId={contactId} handover={handover} onAction={refresh} />
        </div>

        <div className="animate-slide-up stagger-2">
          <DispositionPanel contactId={contactId} currentDisposition={currentDisposition} initialNotes={initialNotes} />
        </div>

        <div className="animate-slide-up stagger-3">
          <ProfileFieldsPanel contactId={contactId} initial={profileFields} />
        </div>
      </div>
    </div>
  );
}
