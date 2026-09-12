/** Parses a rupee amount typed the way Indian users actually type it — "1 lac", "5k",
 * "2.5 lakhs", "1 crore" — not just bare digits. A real bug from a live test: "1 lacs"
 * was being stripped of everything but its digits (Number("1 lacs".replace(/[^\d.]/g,
 * ""))) and silently became ₹1, producing a nonsensical "up to ₹0" eligibility figure.
 */
const MULTIPLIERS: { pattern: RegExp; factor: number }[] = [
  { pattern: /crore|cr\.?/i, factor: 10_000_000 },
  { pattern: /lakhs?|lacs?|\bl\b/i, factor: 100_000 },
  { pattern: /thousand|\bk\b/i, factor: 1_000 },
];

export function parseIndianAmount(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/[₹,]/g, "").replace(/\brs\.?\b|\binr\b/g, "");

  const numberMatch = text.match(/-?\d+(\.\d+)?/);
  if (!numberMatch) return null;
  const base = Number(numberMatch[0]);
  if (!Number.isFinite(base)) return null;

  const remainder = text.slice(numberMatch.index! + numberMatch[0].length);
  const multiplier = MULTIPLIERS.find((m) => m.pattern.test(remainder));

  return base * (multiplier?.factor ?? 1);
}
