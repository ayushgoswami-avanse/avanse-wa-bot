"use client";

import type { Message, Handover } from "@prisma/client";
import ConversationView from "@/components/ConversationView";
import { useLiveThread, type ThreadMeta } from "@/components/useLiveThread";

export default function LiveTranscript({
  contactId,
  initialMessages,
  initialHandover,
  initialInWindow,
  initialMeta,
}: {
  contactId: string;
  initialMessages: Message[];
  initialHandover: Handover | null;
  initialInWindow: boolean;
  initialMeta: ThreadMeta;
}) {
  const { messages } = useLiveThread(contactId, {
    messages: initialMessages,
    handover: initialHandover,
    inWindow: initialInWindow,
    contact: initialMeta,
  });

  return (
    <div className="animate-fade-in bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 p-5 max-h-[70vh] overflow-y-auto brand-scroll shadow-sm">
      <ConversationView messages={messages} />
    </div>
  );
}
