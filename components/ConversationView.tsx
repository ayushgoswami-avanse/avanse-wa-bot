import type { Message } from "@prisma/client";

const GROUP_GAP_MS = 5 * 60 * 1000;

function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function ticksFor(status: string | null): string | null {
  if (status === "read") return "✓✓";
  if (status === "delivered" || status === "sent") return "✓✓";
  if (status === "failed") return "!";
  return null;
}

type Group = { direction: Message["direction"]; sender: "student" | "ai" | "agent"; messages: Message[]; day: string };

function groupMessages(messages: Message[]): Group[] {
  const groups: Group[] = [];
  for (const m of messages) {
    const sender: Group["sender"] = m.direction === "INBOUND" ? "student" : m.sentByAgentId ? "agent" : "ai";
    const day = dayLabel(new Date(m.createdAt));
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];
    const withinGap = lastMsg ? new Date(m.createdAt).getTime() - new Date(lastMsg.createdAt).getTime() < GROUP_GAP_MS : false;

    if (last && last.sender === sender && last.day === day && withinGap) {
      last.messages.push(m);
    } else {
      groups.push({ direction: m.direction, sender, messages: [m], day });
    }
  }
  return groups;
}

function bodyFor(m: Message): string {
  if (m.body) return m.body;
  if (m.kind === "TEMPLATE" && m.templateName) return `[Template: ${m.templateName}]`;
  return `[${m.kind.toLowerCase()}]`;
}

const SENDER_META: Record<Group["sender"], { label: string; avatar: string; avatarClass: string }> = {
  student: { label: "Student", avatar: "S", avatarClass: "bg-slate-200 text-slate-600" },
  ai: { label: "Aanya · AI counsellor", avatar: "AI", avatarClass: "bg-gradient-to-br from-brand-teal to-brand-blue text-white" },
  agent: { label: "Human agent", avatar: "AG", avatarClass: "bg-slate-800 text-white" },
};

export default function ConversationView({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-lg">💬</div>
        <p className="text-sm font-medium text-slate-600">No messages yet</p>
        <p className="text-xs text-slate-500">This thread will fill up as soon as the student messages in.</p>
      </div>
    );
  }

  const groups = groupMessages(messages);
  let lastDay = "";

  return (
    <div className="space-y-4">
      {groups.map((g, gi) => {
        const showDaySeparator = g.day !== lastDay;
        lastDay = g.day;
        const meta = SENDER_META[g.sender];
        const isOutbound = g.direction === "OUTBOUND";

        return (
          <div key={gi}>
            {showDaySeparator && (
              <div className="flex items-center justify-center my-4">
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full px-3 py-1">{g.day}</span>
              </div>
            )}
            <div className={`flex gap-2.5 ${isOutbound ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 mt-auto ${meta.avatarClass}`}>
                {meta.avatar}
              </div>
              <div className={`flex flex-col gap-1 max-w-[72%] ${isOutbound ? "items-end" : "items-start"}`}>
                <span className="text-[11px] font-medium text-slate-500 px-1">{meta.label}</span>
                {g.messages.map((m, mi) => {
                  const isLast = mi === g.messages.length - 1;
                  const ticks = isOutbound ? ticksFor(m.deliveryStatus) : null;
                  return (
                    <div
                      key={m.id}
                      className={[
                        "px-3.5 py-2.5 text-[14.5px] leading-relaxed shadow-sm break-words",
                        isOutbound
                          ? g.sender === "agent"
                            ? "bg-slate-800 text-white"
                            : "bg-gradient-to-br from-brand-teal-dark to-brand-deep text-white"
                          : "bg-white text-slate-800 border border-slate-200",
                        "rounded-2xl",
                        isOutbound && isLast ? "rounded-br-md" : "",
                        !isOutbound && isLast ? "rounded-bl-md" : "",
                      ].join(" ")}
                    >
                      <div className="whitespace-pre-wrap">{bodyFor(m)}</div>
                      <div
                        className={`flex items-center gap-1 mt-1 text-[10.5px] ${
                          isOutbound ? "text-white/70 justify-end" : "text-slate-500"
                        }`}
                      >
                        <span>{timeLabel(new Date(m.createdAt))}</span>
                        {ticks && <span className={m.deliveryStatus === "read" ? "text-sky-300" : ""}>{ticks}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
