import type { Message } from "@prisma/client";

export default function ConversationView({ messages }: { messages: Message[] }) {
  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <div key={m.id} className={`flex ${m.direction === "INBOUND" ? "justify-start" : "justify-end"}`}>
          <div
            className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
              m.direction === "INBOUND" ? "bg-slate-100 text-slate-900" : "bg-slate-900 text-white"
            }`}
          >
            <div className="whitespace-pre-wrap">{m.body || `[${m.kind}]`}</div>
            <div className={`text-[10px] mt-1 ${m.direction === "INBOUND" ? "text-slate-400" : "text-slate-300"}`}>
              {new Date(m.createdAt).toLocaleString()} · {m.kind}
              {m.templateName ? ` · ${m.templateName}` : ""}
            </div>
          </div>
        </div>
      ))}
      {messages.length === 0 && <p className="text-sm text-slate-400">No messages yet.</p>}
    </div>
  );
}
