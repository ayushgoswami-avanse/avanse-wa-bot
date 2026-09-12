import type { TimelineEvent } from "@/lib/timeline";

function formatAt(d: Date): string {
  return new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
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
        <div>
          <div className="text-sm font-semibold text-slate-900">First contact</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {event.attributionTier ? `Attribution: ${event.attributionTier.replaceAll("_", " ").toLowerCase()}` : "No attribution captured"}
            {event.source ? ` · Source: ${event.source.replaceAll("_", " ")}` : ""}
            {event.college ? ` · College: ${event.college}` : ""}
          </div>
        </div>
      );

    case "session": {
      const s = event.session;
      return (
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-900">
              Interaction session · {s.messageCount} message{s.messageCount === 1 ? "" : "s"}
            </div>
            {s.sentiment && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  s.sentiment === "POSITIVE"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : s.sentiment === "NEGATIVE"
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {s.sentiment.toLowerCase()}
              </span>
            )}
          </div>
          {s.summary && <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">{s.summary}</p>}

          {event.changed.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {event.changed.map((c) => (
                <span key={c.key} className="px-2 py-0.5 rounded-full bg-brand-teal-50 text-brand-teal-dark text-[11px] font-medium">
                  {c.label}: {c.from === "—" ? c.to : `${c.from} → ${c.to}`}
                </span>
              ))}
            </div>
          )}

          {Object.keys(event.snapshot).length > 0 && (
            <details className="mt-2 group">
              <summary className="text-[11px] text-slate-500 cursor-pointer select-none hover:text-brand-teal-dark w-fit">
                Full snapshot as of this session
              </summary>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] bg-slate-50 rounded-lg p-2.5">
                {Object.entries(event.snapshot).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-800 font-medium text-right">{String(v)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      );
    }

    case "disposition":
      return (
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Disposition set: <span className="text-violet-700">{DISPOSITION_LABEL[event.disposition] ?? event.disposition}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">by {event.agentName}</div>
          {event.note && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{event.note}</p>}
        </div>
      );

    case "note":
      return (
        <div>
          <div className="text-sm font-semibold text-slate-900">Note from {event.agentName}</div>
          <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{event.body}</p>
        </div>
      );

    case "handover_opened":
      return (
        <div>
          <div className="text-sm font-semibold text-slate-900">Escalated to a human</div>
          <div className="text-xs text-slate-500 mt-0.5">{event.reason.replaceAll("_", " ").toLowerCase()}</div>
        </div>
      );

    case "handover_resolved":
      return (
        <div>
          <div className="text-sm font-semibold text-slate-900">Handover resolved · returned to AI</div>
          <div className="text-xs text-slate-500 mt-0.5">{event.reason.replaceAll("_", " ").toLowerCase()}</div>
        </div>
      );
  }
}

export default function LeadTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No timeline events yet.</p>;
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-slate-200" />
      <div className="space-y-5">
        {events.map((event, i) => (
          <div key={i} className="relative animate-fade-in" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <span className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white ${DOT_STYLE[event.kind]}`} />
            <div className="text-[11px] text-slate-400 mb-1">{formatAt(event.at)}</div>
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
              <EventCard event={event} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
