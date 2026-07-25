import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Lichte DB-backed rate-limiter. Geen externe dependency (Upstash/KV) nodig en
 * werkt over serverless-instances heen. Kleine races zijn acceptabel — de teller
 * kan af en toe 1 te laag zijn, maar blijft de misbruik-drempel bewaken.
 *
 * Retourneert { ok:false, retryAfter } als de limiet is bereikt.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  try {
    const rec = await prisma.rateLimit.findUnique({ where: { key } });
    if (!rec || rec.resetAt.getTime() <= now) {
      const resetAt = new Date(now + windowMs);
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return { ok: true, retryAfter: 0 };
    }
    if (rec.count >= limit) {
      return { ok: false, retryAfter: Math.ceil((rec.resetAt.getTime() - now) / 1000) };
    }
    await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { ok: true, retryAfter: 0 };
  } catch {
    // Bij een DB-storing niet de hele flow blokkeren — fail open.
    return { ok: true, retryAfter: 0 };
  }
}

/** Client-IP uit de request-headers (achter Vercel/proxy). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  // x-real-ip zet Vercel op het echte connectie-IP; dit is NIET client-spoofbaar
  // (i.t.t. de meest-linkse x-forwarded-for-waarde, die de client zelf kan zetten
  // om per request een eigen rate-limit-bucket te krijgen).
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  // Fallback: neem de LAATSTE x-forwarded-for-entry — toegevoegd door de
  // dichtstbijzijnde trusted proxy, niet door de client.
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}
