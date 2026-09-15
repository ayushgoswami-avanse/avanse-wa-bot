"use client";

import SalesBriefCard from "@/components/SalesBriefCard";
import { useLiveThread, type ThreadState } from "@/components/useLiveThread";

/** The top-of-page Sales Brief used to be computed once at page load and never refresh —
 * a new field Guru captured mid-conversation, or an agent's own dropdown edit, sat
 * invisible in this card until a manual browser reload, even though the conversation
 * below it was already updating live. Shares the exact same SSE-ping-then-refetch
 * mechanism as the conversation view (see useLiveThread) so both stay in sync.
 */
export default function LiveSalesBrief({ contactId, initial }: { contactId: string; initial: ThreadState }) {
  const { brief, facts, temperature, segmentTags, contact } = useLiveThread(contactId, initial);
  return <SalesBriefCard brief={brief} waId={contact.waId} temperature={temperature} facts={facts} segmentTags={segmentTags} />;
}
