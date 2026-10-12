import { timingSafeEqual } from "node:crypto";

/**
 * Autorisatie voor cron-/beheer-endpoints: uitsluitend
 * `Authorization: Bearer <CRON_SECRET>`. Vercel Cron stuurt deze header
 * automatisch mee zodra de env-var CRON_SECRET is gezet. De oude
 * `x-vercel-cron`-header is bewust NIET meer geldig — die kan iedereen zetten.
 *
 * Vergelijking is constant-time (timingSafeEqual) zodat de secret niet via
 * timing te raden is. Zonder geconfigureerde secret is álles geweigerd.
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
