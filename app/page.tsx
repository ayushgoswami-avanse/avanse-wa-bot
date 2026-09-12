import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b2e2d] via-[#0f3d3b] to-brand-blue flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-teal/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-brand-blue/20 blur-3xl" />

      <div className="w-full max-w-2xl relative">
        <div className="text-center mb-10 animate-slide-up">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-brand-teal-50 uppercase tracking-wide mb-3 bg-white/10 px-3 py-1 rounded-full">
            Avanse Student Experience Center
          </div>
          <h1 className="text-3xl font-semibold text-white">WhatsApp AI Counsellor — POC</h1>
          <p className="text-sm text-white/70 mt-3 max-w-lg mx-auto">
            QR-attributed acquisition, dual loan journeys, AI counselling with routed search grounding, and DIY handoff —
            running on Gemini + Postgres, with a web chat mirror standing in for WhatsApp wherever a phone isn&apos;t handy.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/chat"
            className="animate-scale-in stagger-1 block bg-white/95 backdrop-blur rounded-xl border border-white/20 p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
          >
            <div className="text-sm font-semibold text-slate-900">Web chat mirror</div>
            <div className="text-xs text-slate-500 mt-1">Try the full student journey — no phone or WhatsApp account needed.</div>
          </Link>
          <Link
            href="/admin"
            className="animate-scale-in stagger-2 block bg-white/95 backdrop-blur rounded-xl border border-white/20 p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
          >
            <div className="text-sm font-semibold text-slate-900">Admin console</div>
            <div className="text-xs text-slate-500 mt-1">Leads, funnel, payouts, cost reporting, settings.</div>
          </Link>
          <Link
            href="/agent"
            className="animate-scale-in stagger-3 block bg-white/95 backdrop-blur rounded-xl border border-white/20 p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
          >
            <div className="text-sm font-semibold text-slate-900">Agent console</div>
            <div className="text-xs text-slate-500 mt-1">AI-suggested replies, sales briefs, human handover.</div>
          </Link>
        </div>

        <p className="text-xs text-white/50 text-center mt-8 animate-fade-in">
          Real WhatsApp: message the test number from a verified recipient phone to reach the same engine.
        </p>
      </div>
    </div>
  );
}
