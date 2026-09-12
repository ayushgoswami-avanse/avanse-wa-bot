import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLeadRows } from "@/lib/reporting";

const COLUMNS: { key: keyof Awaited<ReturnType<typeof getLeadRows>>[number]; header: string }[] = [
  { key: "waId", header: "WhatsApp ID" },
  { key: "name", header: "Name" },
  { key: "journey", header: "Journey" },
  { key: "destinationOrCourse", header: "Destination/Course" },
  { key: "stage", header: "Stage" },
  { key: "leadTemperature", header: "Lead Temperature" },
  { key: "propensityScore", header: "Propensity Score" },
  { key: "attributionTier", header: "Attribution Tier" },
  { key: "college", header: "College" },
  { key: "interactionSessionCount", header: "Interaction Sessions" },
  { key: "lastSentiment", header: "Last Sentiment" },
  { key: "isQualifiedLead", header: "Qualified Lead" },
  { key: "createdAt", header: "First Contact" },
  { key: "lastActiveAt", header: "Last Active" },
];

function csvEscape(value: unknown): string {
  const str = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** FR-I-adjacent, not a BRD requirement — a plain CSV download for Sales, built per
 * direct user feedback rather than requiring them to read the admin table on screen.
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const leads = await getLeadRows();

  const lines = [
    COLUMNS.map((c) => csvEscape(c.header)).join(","),
    ...leads.map((row) => COLUMNS.map((c) => csvEscape(row[c.key])).join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sec-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
