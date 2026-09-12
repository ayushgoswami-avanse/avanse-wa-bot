import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function TranscriptsPage() {
  const contacts = await prisma.contact.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Transcript review</h1>
        <p className="text-sm text-slate-500">FR-I08 — sampling by journey, band and outcome. Every open is logged (FR-H05).</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Contact</th>
              <th className="text-left px-4 py-2">Journey</th>
              <th className="text-left px-4 py-2">Stage</th>
              <th className="text-left px-4 py-2">Propensity</th>
              <th className="text-left px-4 py-2">Messages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/admin/transcripts/${c.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {c.waId}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.journey ?? "—"}</td>
                <td className="px-4 py-2">{c.stage}</td>
                <td className="px-4 py-2">{c.propensityBand ?? "—"}</td>
                <td className="px-4 py-2">{c._count.messages}</td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
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
