"use client";

import ConversationView from "@/components/ConversationView";
import { useLiveThread, type ThreadState } from "@/components/useLiveThread";

export default function LiveTranscript({
  contactId,
  initial,
}: {
  contactId: string;
  initial: ThreadState;
}) {
  const { messages } = useLiveThread(contactId, initial);

  return (
    <div className="animate-fade-in bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 p-5 max-h-[70vh] overflow-y-auto brand-scroll shadow-sm">
      <ConversationView messages={messages} />
    </div>
  );
}
