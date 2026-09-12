import { verifyAndConsumeHandoffToken } from "@/lib/handoff";

/** Stand-in for the real DIY portal (which doesn't exist in this POC). Demonstrates FR-F02:
 * a student arriving via the signed deep link is not asked to re-verify their mobile number.
 */
export default async function PortalPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return <Shell title="DIY Portal (demo stub)">
      <p className="text-slate-600">No handoff token provided. This page simulates where a student lands after tapping &ldquo;Continue application&rdquo; in WhatsApp.</p>
    </Shell>;
  }

  const result = await verifyAndConsumeHandoffToken(token);

  if (!result.ok) {
    const messages = {
      invalid: "This link is invalid.",
      expired: "This link has expired — deep links are short-lived by design (FR-F01, default 15 minutes).",
      replayed: "This link has already been used once. Replay is rejected by design (FR-F01).",
    };
    return (
      <Shell title="Link problem">
        <p className="text-red-600">{messages[result.reason]}</p>
      </Shell>
    );
  }

  const { claims } = result;

  return (
    <Shell title="Welcome back">
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm mb-6">
        Mobile verification skipped — identity source: <strong>{claims.identitySource}</strong> (FR-F02/F06).
      </div>
      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <dt className="text-slate-500">Name</dt>
        <dd className="col-span-2 font-medium text-slate-900">{claims.name ?? "—"}</dd>
        <dt className="text-slate-500">WhatsApp number</dt>
        <dd className="col-span-2 font-medium text-slate-900">{claims.waId}</dd>
        <dt className="text-slate-500">Journey</dt>
        <dd className="col-span-2 font-medium text-slate-900">{claims.journey ?? "—"}</dd>
        <dt className="text-slate-500">Destination / course</dt>
        <dd className="col-span-2 font-medium text-slate-900">{claims.destinationOrCourse ?? "—"}</dd>
        <dt className="text-slate-500">Level</dt>
        <dd className="col-span-2 font-medium text-slate-900">{claims.level ?? "—"}</dd>
        <dt className="text-slate-500">Intake</dt>
        <dd className="col-span-2 font-medium text-slate-900">{claims.intake ?? "—"}</dd>
        <dt className="text-slate-500">Attribution confidence</dt>
        <dd className="col-span-2 font-medium text-slate-900">{claims.attributionTier ?? "—"}</dd>
      </dl>
      <p className="text-xs text-slate-400 mt-8">
        In production this profile pre-fills the real DIY application form (FR-F01). This stub exists because DIY
        does not exist in this POC — see .ai/engineering/tech-debt.md.
      </p>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-lg font-semibold text-slate-900 mb-4">{title}</h1>
        {children}
      </div>
    </div>
  );
}
