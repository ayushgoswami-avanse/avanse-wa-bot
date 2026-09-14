import type { TimelineEvent } from "@/lib/timeline";

function formatAt(d: Date): string {
  return new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const DOT_STYLE: Record<TimelineEvent["kind"], string> = {
  first_contact: "bg-brand-blue",
  session: "bg-brand-teal",
  disposition: "bg-violet-500",
  note: "bg-amber-500",
  handover_opened: "bg-red-500",
  handover_resolved: "bg-emerald-500",
};

const DISPOSITION_LABEL: Record<string, string> = {
  NEW: "New",
  INTERESTED: "Interested",
  HOT_FOLLOW_UP: "Hot follow-up",
  CALLBACK_REQUESTED: "Callback requested",
  NOT_INTERESTED: "Not interested",
  CONVERTED: "Converted",
  DO_NOT_CONTACT: "Do not contact",
  INVALID_CONTACT: "Invalid contact",
  DUPLICATE: "Duplicate",
};

function EventCard({ event }: { event: TimelineEvent }) {
  switch (event.kind) {
    case "first_contact":
      return (
        <>
          <div className="text-xs font-semibold text-slate-900">First contact</div>
          <div className="text-[11px] text-slate-500 mt-1 leading-snug">{event.sourceSummary}</div>
          {event.attributionTier && (
            <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded bg-brand-blue-50 text-brand-blue text-[10px] font-medium">
              {event.attributionTier.replaceAll("_", " ").toLowerCase()}
            </span>
          )}
        </>
      );

    case "session": {
      const s = event.session;
      const shown = event.changed.slice(0, 4);
      const more = event.changed.length - shown.length;
      return (
        <>
          <div className="flex items-center justify-between gap-1.5">
            <div className="text-xs font-semibold text-slate-900">
              {s.messageCount} msg{s.messageCount === 1 ? "" : "s"}
            </div>
            {s.sentiment && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                  s.sentiment === "POSITIVE"
                    ? "bg-emerald-50 text-emerald-700"
                    : s.sentiment === "NEGATIVE"
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {s.sentiment.toLowerCase()}
              </span>
            )}
          </div>
          {s.summary && <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{s.summary.split("\n").pop()?.replace(/^- /, "")}</p>}
          {shown.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {shown.map((c) => (
                <span key={c.key} className="px-1.5 py-0.5 rounded bg-brand-teal-50 text-brand-teal-dark text-[10px] font-medium">
                  {c.label}: {c.to}
                </span>
              ))}
              {more > 0 && <span className="text-[10px] text-slate-400 self-center">+{more} more</span>}
            </div>
          )}
        </>
      );
    }

    case "disposition":
      return (
        <>
          <div className="text-xs font-semibold text-violet-700">{DISPOSITION_LABEL[event.disposition] ?? event.disposition}</div>
          <div className="text-[10.5px] text-slate-500 mt-1">by {event.agentName}</div>
          {event.note && <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{event.note}</p>}
        </>
      );

    case "note":
      return (
        <>
          <div className="text-xs font-semibold text-slate-900">Note · {event.agentName}</div>
          <p className="text-[11px] text-slate-600 mt-1 line-clamp-3">{event.body}</p>
        </>
      );

    case "handover_opened":
      return (
        <>
          <div className="text-xs font-semibold text-red-700">Escalated to human</div>
          <div className="text-[10.5px] text-slate-500 mt-1">{event.reason.replaceAll("_", " ").toLowerCase()}</div>
        </>
      );

    case "handover_resolved":
      return (
        <>
          <div className="text-xs font-semibold text-emerald-700">Handover resolved</div>
          <div className="text-[10.5px] text-slate-500 mt-1">back to AI · {event.reason.replaceAll("_", " ").toLowerCase()}</div>
        </>
      );
  }
}

/** Horizontal, scrollable timeline strip — one card per acquisition/session/disposition/note/
 * handover event, oldest to newest left-to-right, each surfacing the key parameters that
 * changed at that moment so a telecaller can skim the whole journey without opening anything.
 */
export default function LeadTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No timeline events yet.</p>;
  }

  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-[15px] h-px bg-slate-200" />
      <div className="flex gap-3 overflow-x-auto brand-scroll pb-2 pt-0.5 snap-x snap-proximity">
        {events.map((event, i) => (
          <div key={i} className="snap-start shrink-0 w-[200px] animate-fade-in" style={{ animationDelay: `${Math.min(i, 14) * 25}ms` }}>
            <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
              <span className={`w-2.5 h-2.5 rounded-full ring-[3px] ring-white ${DOT_STYLE[event.kind]}`} />
              <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatAt(event.at)}</span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm h-[104px] overflow-hidden">
              <EventCard event={event} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
