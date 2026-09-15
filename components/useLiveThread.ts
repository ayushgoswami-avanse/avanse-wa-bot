"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message, Handover } from "@prisma/client";
import type { SalesBrief } from "@/lib/salesBrief";
import type { FactSection } from "@/lib/leadFacts";

export type ThreadMeta = {
  id: string;
  waId: string;
  journey: string | null;
  stage: string;
  attributionTier: string | null;
  propensityBand: string | null;
  destinationCountry: string | null;
  courseCategory: string | null;
};

export type ThreadState = {
  messages: Message[];
  handover: Handover | null;
  inWindow: boolean;
  contact: ThreadMeta;
  brief: SalesBrief;
  facts: FactSection[];
  temperature: "Hot" | "Warm" | "Cold";
  segmentTags: string[];
};

/** Keeps a thread view in sync with reality without a manual reload: subscribes to the
 * per-contact SSE ping, refetches the authoritative JSON on every ping (and a slow
 * safety-net poll in case the connection drops), and exposes a manual `refresh()` for
 * actions taken from this same tab (send, claim, resolve).
 */
export function useLiveThread(contactId: string, initial: ThreadState) {
  const [state, setState] = useState<ThreadState>(initial);
  const fetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch(`/api/agent/thread/${contactId}`, { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      // transient — the next ping or poll tick will retry
    } finally {
      fetchingRef.current = false;
    }
  }, [contactId]);

  useEffect(() => {
    const es = new EventSource(`/api/agent/thread/${contactId}/stream`);
    es.onmessage = () => refresh();
    es.onerror = () => {
      // EventSource auto-reconnects; the interval below covers the gap meanwhile.
    };
    const poll = setInterval(refresh, 12000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [contactId, refresh]);

  return { ...state, refresh };
}
