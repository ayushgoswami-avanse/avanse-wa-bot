import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { publishToWebMirror } from "@/lib/webMirror/bus";
import { recomputeAndPersistPropensity } from "@/lib/propensity";
import { isQualifiedLead } from "@/lib/conversation/qualification";
import { syncToProcessioIfGated } from "@/lib/handoff";

/** Lets an agent or admin fill in profiling fields directly — the counsellor-on-a-phone-call
 * case, where the student gives details out loud instead of typing them into WhatsApp.
 * Guru also writes these same fields (lib/conversation/orchestrator.ts's save_student_profile
 * tool); this is the human-editable path onto the identical columns, not a separate model.
 */
const EDITABLE_STRING_FIELDS = [
  "confirmedName",
  "destinationCountry",
  "degreeLevel",
  "fieldOfStudy",
  "intendedIntake",
  "currentYearOfStudy",
  "testStatus",
  "admissionStatus",
  "courseCategory",
  "targetInstitution",
  "intakeOrBatch",
  "employmentStatus",
  "entranceStatus",
] as const;

const VALID_JOURNEYS = new Set(["INTERNATIONAL", "DOMESTIC", "UNDECIDED"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { contactId, updates } = (await req.json()) as { contactId?: string; updates?: Record<string, string> };
  if (!contactId || !updates || typeof updates !== "object") {
    return NextResponse.json({ error: "contactId and updates are required" }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, string> = {};
  for (const field of EDITABLE_STRING_FIELDS) {
    const value = updates[field];
    if (typeof value === "string" && value.trim()) data[field] = value.trim().slice(0, 200);
  }
  if (typeof updates.journey === "string" && VALID_JOURNEYS.has(updates.journey)) {
    data.journey = updates.journey;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  await prisma.contact.update({ where: { id: contactId }, data });
  await recomputeAndPersistPropensity(contactId);

  const fresh = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  if (!fresh.isQualifiedLead && isQualifiedLead(fresh)) {
    await prisma.contact.update({ where: { id: contactId }, data: { isQualifiedLead: true, qualifiedAt: new Date() } });
    void syncToProcessioIfGated(await prisma.contact.findUniqueOrThrow({ where: { id: contactId } }));
  }

  publishToWebMirror(contact.waId, { type: "activity" });
  return NextResponse.json({ ok: true, updated: Object.keys(data) });
}
