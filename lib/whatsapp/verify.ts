import { createHmac, timingSafeEqual } from "crypto";

/** NFR-15 / FR-B01 — validate X-Hub-Signature-256 against the app secret before trusting
 * any webhook body. Must run on the raw request body, before JSON parsing.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.replace("sha256=", "");

  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/** Meta's webhook verification handshake (GET request with hub.mode/hub.verify_token). */
export function verifySubscriptionChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  if (mode !== "subscribe" || !challenge) return null;
  if (token !== process.env.META_VERIFY_TOKEN) return null;
  return challenge;
}
