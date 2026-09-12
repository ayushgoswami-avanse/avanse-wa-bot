import { NextRequest, NextResponse } from "next/server";

/** INT-08 — stand-in for Processio LOS, which doesn't exist in this POC. Accepts the
 * exact extended payload shape from FR-F05 and always succeeds, so the sync gate and
 * schema are demonstrably real even though the destination system is simulated.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("[mock-processio] received lead sync:", JSON.stringify(body));
  return NextResponse.json({ received: true, processioLeadId: `MOCK-${Date.now()}` });
}
