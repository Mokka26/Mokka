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

/** Beste-gok client-IP uit de request-headers (achter Vercel/proxy). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
