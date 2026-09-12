import corpus from "@/data/outcomes-corpus.json";

/** FR-D02 — proprietary RAG over the student outcome corpus, partitioned by journey
 * (TR-08). POC simplification: keyword-overlap retrieval over a small synthetic corpus
 * rather than a real vector store — swap for embeddings + pgvector when real outcome
 * data exists. Logged in .ai/engineering/tech-debt.md.
 */

type InternationalOutcome = (typeof corpus.international)[number];
type DomesticOutcome = (typeof corpus.domestic)[number];

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function overlapScore(queryTokens: string[], text: string): number {
  const textTokens = new Set(tokenize(text));
  return queryTokens.filter((t) => textTokens.has(t)).length;
}

export function retrieveInternationalOutcomes(
  query: string,
  collegeName: string | null,
  limit = 3
): InternationalOutcome[] {
  const queryTokens = tokenize(query);
  const scored = corpus.international.map((row) => {
    const collegeBoost = collegeName && row.collegeName.toLowerCase() === collegeName.toLowerCase() ? 5 : 0;
    const text = `${row.collegeName} ${row.destinationCountry} ${row.course}`;
    return { row, score: overlapScore(queryTokens, text) + collegeBoost };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.row);
}

export function retrieveDomesticOutcomes(
  query: string,
  collegeName: string | null,
  limit = 3
): DomesticOutcome[] {
  const queryTokens = tokenize(query);
  const scored = corpus.domestic.map((row) => {
    const collegeBoost = collegeName && row.collegeName.toLowerCase() === collegeName.toLowerCase() ? 5 : 0;
    const text = `${row.collegeName} ${row.courseCategory} ${row.course}`;
    return { row, score: overlapScore(queryTokens, text) + collegeBoost };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.row);
}

export function formatOutcomesForPrompt(
  journey: "INTERNATIONAL" | "DOMESTIC",
  outcomes: (InternationalOutcome | DomesticOutcome)[]
): string {
  if (outcomes.length === 0) return "No closely matching outcome records for this query.";

  if (journey === "INTERNATIONAL") {
    return (outcomes as InternationalOutcome[])
      .map(
        (o) =>
          `- A student from ${o.collegeName} was admitted to ${o.admittedTo} (${o.destinationCountry}) for ${o.course} in ${o.year}` +
          (o.scholarshipPct ? `, with a ${o.scholarshipPct}% scholarship` : "") +
          `. Reported starting salary: ~$${o.startingSalaryUsd.toLocaleString()}/yr.`
      )
      .join("\n");
  }

  return (outcomes as DomesticOutcome[])
    .map(
      (o) =>
        `- A student from ${o.collegeName} went on to ${o.admittedTo} for ${o.course} (${o.courseCategory}) in ${o.year}. ` +
        `Reported starting salary: ~₹${o.startingSalaryInr.toLocaleString("en-IN")}/yr.`
    )
    .join("\n");
}
