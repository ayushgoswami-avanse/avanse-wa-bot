import { prisma } from "@/lib/prisma";
import { getConfigBool } from "@/lib/config";

/** Module E — Tier 1 indicative eligibility (BRD FR-E01..FR-E06, PRD Layer 5).
 * All computation is delegated to /api/mock/diy-bre (INT-05) — see FR-E02: no FOIR
 * coefficients live here or in the RAG corpus.
 */

export type Tier1Input = {
  coApplicantIncome: number;
  existingEmis: number;
  destinationOrCourse: string;
  courseType: string;
  amountSought: number;
};

export type Tier1Result =
  | { ok: true; upToAmount: number; disclaimerVersion: string; asOf: string }
  | { ok: false; reason: "feature_disabled" | "bre_error" };

const DISCLAIMER =
  "This is an indicative 'up to' figure only, not a sanction or a binding offer. Your final " +
  "eligibility, interest rate and terms are decided by underwriting after a full application.";

export function eligibilityDisclaimerText(): string {
  return DISCLAIMER;
}

export async function requestTier1Eligibility(
  contactId: string,
  input: Tier1Input
): Promise<Tier1Result> {
  // FR-E04 — feature flag to disable Tier 1 entirely without redeployment.
  const enabled = await getConfigBool("FEATURE_TIER1_ELIGIBILITY_ENABLED");
  if (!enabled) return { ok: false, reason: "feature_disabled" };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let breResponse: { upToAmount: number; disclaimerVersion: string; asOf: string };
  try {
    const res = await fetch(`${baseUrl}/api/mock/diy-bre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, reason: "bre_error" };
    breResponse = await res.json();
  } catch {
    return { ok: false, reason: "bre_error" };
  }

  // FR-E06 — every request's inputs, BRE response, displayed figure and disclaimer
  // version are persisted, audit-style.
  await prisma.eligibilityRequest.create({
    data: {
      contactId,
      coApplicantIncome: input.coApplicantIncome,
      existingEmis: input.existingEmis,
      destinationOrCourse: input.destinationOrCourse,
      courseType: input.courseType,
      amountSought: input.amountSought,
      breResponseUpToAmount: breResponse.upToAmount,
      disclaimerVersion: breResponse.disclaimerVersion,
      featureFlagWasOn: true,
    },
  });

  return {
    ok: true,
    upToAmount: breResponse.upToAmount,
    disclaimerVersion: breResponse.disclaimerVersion,
    asOf: breResponse.asOf,
  };
}
