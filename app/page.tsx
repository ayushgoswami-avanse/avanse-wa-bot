import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Avanse Student Experience Center</div>
          <h1 className="text-2xl font-semibold text-slate-900">WhatsApp AI Counsellor — POC</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
            QR-attributed acquisition, dual loan journeys, AI counselling with routed search grounding, and DIY handoff —
            running on Gemini + Postgres, with a web chat mirror standing in for WhatsApp wherever a phone isn&apos;t handy.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/chat" className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-400 transition-colors">
            <div className="text-sm font-semibold text-slate-900">Web chat mirror</div>
            <div className="text-xs text-slate-500 mt-1">Try the full student journey — no phone or WhatsApp account needed.</div>
          </Link>
          <Link href="/admin" className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-400 transition-colors">
            <div className="text-sm font-semibold text-slate-900">Admin console</div>
            <div className="text-xs text-slate-500 mt-1">Assets &amp; QR, funnel, payouts, cost reporting, settings.</div>
          </Link>
          <Link href="/agent" className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-400 transition-colors">
            <div className="text-sm font-semibold text-slate-900">Agent console</div>
            <div className="text-xs text-slate-500 mt-1">Thread list, conversation view, human handover.</div>
          </Link>
        </div>

        <p className="text-xs text-slate-400 text-center mt-8">
          Real WhatsApp: message the test number from a verified recipient phone to reach the same engine.
        </p>
      </div>
    </div>
  );
}
