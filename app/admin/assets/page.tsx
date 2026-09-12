import { prisma } from "@/lib/prisma";
import NewAssetForm from "./NewAssetForm";

export default async function AssetsPage() {
  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clickRecords: true } }, ambassador: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Assets &amp; QR codes</h1>
        <p className="text-sm text-slate-500">FR-A01/I01 — every physical or digital touchpoint, registered with a permanent opaque code.</p>
      </div>

      <NewAssetForm />

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Code</th>
              <th className="text-left px-4 py-2">Channel</th>
              <th className="text-left px-4 py-2">College</th>
              <th className="text-left px-4 py-2">Spot</th>
              <th className="text-left px-4 py-2">Ambassador</th>
              <th className="text-left px-4 py-2">Clicks</th>
              <th className="text-left px-4 py-2">QR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assets.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2 font-mono">{a.code}</td>
                <td className="px-4 py-2">{a.channel}</td>
                <td className="px-4 py-2">{a.collegeName ?? "—"}</td>
                <td className="px-4 py-2">{a.spotLabel ?? "—"}</td>
                <td className="px-4 py-2">{a.ambassador?.name ?? "—"}</td>
                <td className="px-4 py-2">{a._count.clickRecords}</td>
                <td className="px-4 py-2">
                  <a href={`/api/qr/${a.code}`} target="_blank" className="text-blue-600 hover:underline">
                    Download
                  </a>
                </td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No assets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
