import { prisma } from "@/lib/prisma";
import { rateLimitIp } from "@/lib/rate-limit";
import { captureError } from "@/lib/sentry";
import { verifyUnsubscribe, type UnsubscribeOutcome } from "@/lib/newsletter-unsubscribe";

/**
 * Meld af op basis van een ondertekende link (zie lib/newsletter-unsubscribe.ts).
 * Idempotent en verraadt niet of het adres op de lijst stond: bij een geldige
 * handtekening altijd "done". Rate-limit per IP zoals de andere
 * nieuwsbriefroutes; de handtekening wordt eerst (zonder DB) gecontroleerd.
 */
export async function unsubscribeBySignedLink(
  encoded: string | null | undefined,
  token: string | null | undefined,
  opts: { scope: string; limit: number; headers?: Headers },
): Promise<UnsubscribeOutcome> {
  const email = verifyUnsubscribe(encoded, token);
  if (!email) return "invalid";

  const rl = await rateLimitIp(opts.scope, opts.limit, 10 * 60 * 1000, { headers: opts.headers });
  if (!rl.ok) return "error";

  try {
    await prisma.newsletterSubscriber.updateMany({
      where: { email, unsubscribedAt: null },
      data: { unsubscribedAt: new Date(), confirmToken: null, confirmTokenAt: null },
    });
    return "done";
  } catch (e) {
    captureError(e, { scope: "newsletterUnsubscribe" });
    return "error";
  }
}
