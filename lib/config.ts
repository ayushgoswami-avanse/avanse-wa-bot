import { prisma } from "@/lib/prisma";

/**
 * Runtime configuration store (NFR-26: allow-lists, caps, thresholds, TTLs and feature
 * flags must be changeable without a redeploy). Backed by SystemConfig, seeded with
 * defaults on first read. The admin console's Settings page writes through this.
 */

export const CONFIG_DEFAULTS = {
  FEATURE_TIER1_ELIGIBILITY_ENABLED: "true", // FR-E04
  REDIRECT_FAILOVER_TARGET: "whatsapp", // "whatsapp" | "web_mirror" — FR-A10
  DEBOUNCE_WINDOW_MS: "3000", // FR-B03
  ATTRIBUTION_RECOVERY_WINDOW_MINUTES: "30", // FR-A05
  MARKETING_TEMPLATES_PER_CONTACT_FORTNIGHT: "1", // FR-G04 (fortnightly cap)
  BLOCK_REPORT_RATE_PAUSE_THRESHOLD_PCT: "0.5", // FR-G06 / NFR
  QUALITY_RATING: "high", // "high" | "medium" | "low" — FR-G05, simulated toggle for the demo
  DAILY_SPEND_CEILING_INR: "5000", // FR-G08
  MONTHLY_SPEND_CEILING_INR: "100000", // FR-G08
  PER_CONTACT_DAILY_MODEL_CALL_LIMIT: "40", // FR-G09
  GROUNDING_ALWAYS_ALLOW_TOPICS:
    "visa rules,visa fees,application deadline,intake deadline,forex,remittance limit,regulatory change,institution requirement", // FR-D04
  SEMANTIC_CACHE_TTL_MINUTES: "1440", // FR-D07
  PROPENSITY_SYNC_GATE_MIN_BAND: "MEDIUM", // FR-F04 — only Medium+ leads sync to Processio
  SESSION_GAP_MINUTES: "30", // a new inbound message after this much silence starts a new InteractionSession
} as const;

export type ConfigKey = keyof typeof CONFIG_DEFAULTS;

export async function getConfig(key: ConfigKey): Promise<string> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row?.value ?? CONFIG_DEFAULTS[key];
}

export async function getAllConfig(): Promise<Record<ConfigKey, string>> {
  const rows = await prisma.systemConfig.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result = {} as Record<ConfigKey, string>;
  for (const key of Object.keys(CONFIG_DEFAULTS) as ConfigKey[]) {
    result[key] = map.get(key) ?? CONFIG_DEFAULTS[key];
  }
  return result;
}

export async function setConfig(key: ConfigKey, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getConfigBool(key: ConfigKey): Promise<boolean> {
  return (await getConfig(key)).toLowerCase() === "true";
}

export async function getConfigNumber(key: ConfigKey): Promise<number> {
  return Number(await getConfig(key));
}

export async function getConfigList(key: ConfigKey): Promise<string[]> {
  const raw = await getConfig(key);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
