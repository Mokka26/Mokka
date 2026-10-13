import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";
import { captureError } from "@/lib/sentry";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_EMAIL_MAX_FAILURES = 5;

// Dummy-hash zodat een onbekend e-mailadres net zo lang duurt als een fout
// wachtwoord (geen user-enumeratie via timing). Zelfde cost (12) als de echte
// hashes (settings/actions.ts, scripts/seed-admin.ts) — anders verraadt de
// duur alsnog of het account bestaat.
const DUMMY_HASH = "$2b$12$PnEKjsVsVeyiw8YzNvN9fuljIpMrHUTwsYaQrlYI0tovdb/kf9IBi";

// ─── Mislukte inlogpogingen per e-mailadres ────────────────────────
//
// Alleen MISLUKTE pogingen tellen mee (een geslaagde login reset de teller),
// zodat een beheerder die gewoon vaak inlogt zichzelf niet buitensluit. De
// IP-bucket (rateLimitIp "auth") telt wél elke poging: die vangt floods.

const emailFailKey = (email: string) => `auth:email-fail:${email.toLowerCase()}`;

/**
 * Is dit adres geblokkeerd door te veel mislukte pogingen? Leest alleen (telt
 * niets op). Fail closed: zonder bereikbare database geen login.
 */
export async function isLoginEmailBlocked(email: string): Promise<boolean> {
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key: emailFailKey(email) }, select: { count: true, resetAt: true } });
    if (!row) return false;
    return row.resetAt.getTime() > Date.now() && row.count >= LOGIN_EMAIL_MAX_FAILURES;
  } catch (e) {
    captureError(e, { scope: "auth.isLoginEmailBlocked" });
    return true;
  }
}

/** Telt een mislukte poging mee in de e-mailbucket (venster 15 min). */
export async function recordFailedLogin(email: string): Promise<void> {
  await rateLimit(emailFailKey(email), LOGIN_EMAIL_MAX_FAILURES, LOGIN_WINDOW_MS, { failClosed: true });
}

/** Geslaagde login: de teller van mislukte pogingen voor dit adres wissen. */
export async function resetFailedLogins(email: string): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { key: emailFailKey(email) } });
  } catch (e) {
    captureError(e, { scope: "auth.resetFailedLogins" });
  }
}

/**
 * passwordChangedAt per admin, kort gecached per serverless-instance zodat
 * niet élke auth()-aanroep de DB raakt. 30 s vertraging bij het invalideren
 * van oude sessies is acceptabel.
 */
const pwdCache = new Map<string, { at: number; value: number }>();
const PWD_CACHE_MS = 30_000;

/** Na een wachtwoordwijziging: de cache voor deze admin (op deze instance) legen. */
export function invalidatePasswordCache(userId: string): void {
  pwdCache.delete(userId);
}

async function passwordChangedAtMs(userId: string): Promise<number | null> {
  const cached = pwdCache.get(userId);
  if (cached && Date.now() - cached.at < PWD_CACHE_MS) return cached.value;
  try {
    const user = await prisma.adminUser.findUnique({ where: { id: userId }, select: { passwordChangedAt: true } });
    if (!user) return null; // account verwijderd → sessie ongeldig
    const value = user.passwordChangedAt?.getTime() ?? 0;
    pwdCache.set(userId, { at: Date.now(), value });
    return value;
  } catch (e) {
    captureError(e, { scope: "auth.passwordChangedAt" });
    // DB even onbereikbaar: sessie laten staan (de admin-pagina's zelf falen dan toch).
    return cached?.value ?? 0;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Expliciet: accepteer zowel de v5-naam (AUTH_SECRET) als de v4-naam
  // (NEXTAUTH_SECRET), zodat de juiste env-var altijd gevonden wordt.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        // Bruteforce-bescherming ÍN authorize zelf: een directe POST op
        // /api/auth/callback/credentials omzeilt anders de limiet in de
        // login-action. Fail closed: zonder werkende limiter geen login.
        const [byIp, emailBlocked] = await Promise.all([
          rateLimitIp("auth", 10, LOGIN_WINDOW_MS, { failClosed: true, headers: request.headers }),
          isLoginEmailBlocked(email),
        ]);
        if (!byIp.ok || emailBlocked) return null;

        const user = await prisma.adminUser.findUnique({ where: { email } });
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok) {
          await recordFailedLogin(email);
          return null;
        }
        await resetFailedLogins(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          pwdAt: user.passwordChangedAt?.getTime() ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      if (params.user || typeof token.id !== "string") return token;
      // Wachtwoord gewijzigd ná het inloggen → sessie ongeldig. We vergelijken
      // met token.pwdAt (vastgelegd bij login) en niet met token.iat: de proxy
      // (edge) ver-encodeert het token bij elk request met een verse iat, en
      // zou de check anders omzeilen.
      const changedAt = await passwordChangedAtMs(token.id);
      if (changedAt === null) return null;
      const loginPwdAt = typeof token.pwdAt === "number" ? token.pwdAt : 0;
      if (changedAt > loginPwdAt) return null;
      return token;
    },
  },
});
