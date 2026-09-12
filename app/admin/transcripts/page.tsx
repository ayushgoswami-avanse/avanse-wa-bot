import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Avatar, StageBadge, TemperatureBadge } from "@/components/ui/Badge";
import { bandToTemperature } from "@/lib/propensity";

export default async function TranscriptsPage() {
  const contacts = await prisma.contact.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div className="space-y-5">
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold text-slate-900">Transcript review</h1>
        <p className="text-sm text-slate-500">Sampling by journey, band and outcome. Every open is logged.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Contact</th>
              <th className="text-left px-4 py-2">Journey</th>
              <th className="text-left px-4 py-2">Stage</th>
              <th className="text-left px-4 py-2">Temperature</th>
              <th className="text-left px-4 py-2">Messages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((c, i) => (
              <tr key={c.id} className="animate-fade-in hover:bg-brand-teal-50/40 transition-colors" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/transcripts/${c.id}`} className="flex items-center gap-2.5 group">
                    <Avatar name={c.confirmedName ?? c.profileName ?? c.waId} />
                    <span className="font-mono text-xs text-slate-600 group-hover:text-brand-teal-dark transition-colors">{c.waId}</span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.journey ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <StageBadge stage={c.stage} />
                </td>
                <td className="px-4 py-2.5">
                  <TemperatureBadge value={bandToTemperature(c.propensityBand)} />
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c._count.messages}</td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No conversations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
