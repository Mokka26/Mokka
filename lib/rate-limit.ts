import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/sentry";

/**
 * DB-backed rate-limiter. Geen externe dependency (Upstash/KV) nodig en werkt
 * over serverless-instances heen. De teller wordt ATOMAIR bijgewerkt met één
 * `INSERT … ON CONFLICT DO UPDATE` — geen read-then-write-race meer waarin
 * gelijktijdige requests elkaars verhoging overschrijven.
 *
 * Verlopen rijen (resetAt < now) worden dagelijks opgeruimd door
 * /api/cron/cleanup.
 */

export type RateLimitResult = { ok: boolean; retryAfter: number };

export type RateLimitOptions = {
  /**
   * Bij een DB-storing: `false` (default) laat de aanvraag door (fail open —
   * formulieren/checkout mogen niet stilvallen door een hik), `true` weigert
   * (fail closed — voor login/bruteforce-gevoelige paden).
   */
  failClosed?: boolean;
};

type Row = { count: number; resetAt: Date };

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  opts: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const now = Date.now();
  const freshResetAt = new Date(now + windowMs);
  try {
    const rows = await prisma.$queryRaw<Row[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${freshResetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN ${freshResetAt} ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`;
    const row = rows[0];
    if (!row) throw new Error("rateLimit: geen rij terug van upsert");
    if (row.count > limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((row.resetAt.getTime() - now) / 1000)) };
    }
    return { ok: true, retryAfter: 0 };
  } catch (e) {
    captureError(e, { scope: "rateLimit", key: key.split(":").slice(0, 2).join(":"), failClosed: !!opts.failClosed });
    if (opts.failClosed) return { ok: false, retryAfter: 60 };
    return { ok: true, retryAfter: 0 };
  }
}

/**
 * Client-IP uit de request-headers (achter Vercel/proxy). Geef `h` mee als je
 * al een Headers-object hebt (bv. in NextAuth `authorize(_, request)`); anders
 * wordt next/headers gebruikt.
 *
 * Volgorde: x-real-ip (door Vercel/nginx gezet op het échte verbindings-IP,
 * niet client-spoofbaar) → eerste x-forwarded-for-waarde (Vercel herschrijft
 * die header naar het client-IP) → "unknown". Voor "unknown" gebruikt
 * rateLimitIp een aparte, strengere bucket.
 */
export async function clientIp(h?: Headers): Promise<string> {
  const hdrs = h ?? (await headers());
  const real = hdrs.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = hdrs.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * Rate-limit per client-IP onder een scope (bv. "checkout", "login").
 * Zonder herleidbaar IP ("unknown") delen alle anonieme requests één bucket
 * met een vijfmaal lagere limiet — zo kan een header-loze client de limiet
 * nooit omzeilen, zonder dat één proxy-hik meteen iedereen blokkeert.
 */
export async function rateLimitIp(
  scope: string,
  limit: number,
  windowMs: number,
  opts: RateLimitOptions & { headers?: Headers } = {},
): Promise<RateLimitResult> {
  const ip = await clientIp(opts.headers);
  const effectiveLimit = ip === "unknown" ? Math.max(1, Math.floor(limit / 5)) : limit;
  return rateLimit(`${scope}:ip:${ip}`, effectiveLimit, windowMs, { failClosed: opts.failClosed });
}
