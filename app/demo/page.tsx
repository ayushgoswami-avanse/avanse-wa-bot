import Link from "next/link";

export const metadata = { title: "Scan to start — Avanse SEC" };

/** A dummy/test QR touchpoint for live management walkthroughs — mimics what a printed
 * campus poster or digital screen looks like, backed by the "demo1" asset seeded in
 * prisma/seed.ts (channel: "demo", never used on a real campus). Scanning it runs the
 * exact same acquisition → attribution → AI-counselling flow as a real poster would.
 */
export default function DemoPosterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b2e2d] via-[#0f3d3b] to-brand-blue flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-teal/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-brand-blue/20 blur-3xl" />

      <div className="w-full max-w-sm relative animate-scale-in">
        <div className="bg-white rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-brand-teal-dark to-brand-deep px-6 py-5 text-center">
            <div className="inline-flex items-center gap-2 text-white">
              <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-xs font-bold">AV</span>
              <span className="font-semibold">Avanse Student Experience Center</span>
            </div>
          </div>

          <div className="px-6 pt-6 pb-2 text-center">
            <h1 className="text-lg font-semibold text-slate-900">Funding your education abroad or in India?</h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Scan to chat with our AI counsellor on WhatsApp — get instant answers, an indicative eligibility check,
              and a fast-tracked application.
            </p>
          </div>

          <div className="flex justify-center py-5">
            <div className="p-3 rounded-2xl border-2 border-slate-100 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/qr/demo1" alt="Scan to start on WhatsApp" width={220} height={220} className="rounded-lg" />
            </div>
          </div>

          <div className="px-6 pb-6 text-center space-y-3">
            <p className="text-xs text-slate-400">Point your phone camera at the code — it opens WhatsApp automatically.</p>
            <Link
              href="/chat"
              className="block text-sm font-medium text-brand-teal-dark hover:text-brand-deep border border-brand-teal/30 hover:bg-brand-teal-50 rounded-xl py-2.5 transition-colors"
            >
              No phone handy? Try it in your browser →
            </Link>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/50 mt-4">
          Live walkthrough QR for internal demos — not a real campus touchpoint.
        </p>
      </div>
    </div>
  );
}
