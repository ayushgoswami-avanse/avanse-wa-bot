import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/** INT-05 — mock of the DIY Business Rules Engine, standing in for a real Avanse system
 * that does not exist in this POC. This is the ONLY place any FOIR-style credit logic
 * lives (FR-E02: "no credit logic in the bot"). If this were removed, Tier 1 eligibility
 * would have nowhere to compute a figure — which is the point: the bot never guesses.
 */

const RequestSchema = z.object({
  coApplicantIncome: z.number().positive(),
  existingEmis: z.number().min(0),
  destinationOrCourse: z.string(),
  courseType: z.string(),
  amountSought: z.number().positive(),
});

const FOIR_CAP = 0.5; // simplified fixed-obligation-to-income ratio ceiling
const TENOR_MONTHS = 96; // 8-year indicative tenor
const INDICATIVE_ANNUAL_RATE = 0.105;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { coApplicantIncome, existingEmis, amountSought } = parsed.data;

  const disposableIncome = Math.max(0, coApplicantIncome - existingEmis);
  const eligibleEmiCapacity = disposableIncome * FOIR_CAP;

  const r = INDICATIVE_ANNUAL_RATE / 12;
  const eligibleByEmi =
    eligibleEmiCapacity * ((1 - Math.pow(1 + r, -TENOR_MONTHS)) / r);

  const upToAmount = Math.max(0, Math.min(amountSought, Math.round(eligibleByEmi / 10000) * 10000));

  return NextResponse.json({
    upToAmount,
    disclaimerVersion: "diy-bre-interim-v1",
    assumptions: {
      foirCap: FOIR_CAP,
      tenorMonths: TENOR_MONTHS,
      indicativeAnnualRate: INDICATIVE_ANNUAL_RATE,
    },
    asOf: new Date().toISOString().slice(0, 10),
  });
}
