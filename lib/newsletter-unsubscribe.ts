import { createHmac, timingSafeEqual } from "node:crypto";
import { businessInfo } from "@/lib/business-info";

/**
 * Afmelden voor de nieuwsbrief zonder login: elke nieuwsbriefmail bevat een
 * link met het (base64url) e-mailadres en een HMAC-handtekening daarover.
 * Geen extra databasekolom nodig; de link blijft geldig zolang AUTH_SECRET
 * niet wijzigt (bij rotatie werken oude links niet meer — de pagina verwijst
 * dan naar mail/telefoon).
 *
 * Twee ingangen:
 *  - /nieuwsbrief/afmelden?e=…&t=…  (link in de mail; afmelden via een knop,
 *    nooit op GET — mailscanners openen links)
 *  - POST /api/newsletter/unsubscribe?e=…&t=…  (RFC 8058 one-click, via de
 *    List-Unsubscribe- en List-Unsubscribe-Post-headers)
 */

const PURPOSE = "newsletter-unsubscribe:v1:";
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes HMAC-SHA256 als base64url
const ENCODED_EMAIL_RE = /^[A-Za-z0-9_-]{4,200}$/;

function defaultKey(): string | null {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  return s && s.trim() ? s : null;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export function encodeEmail(email: string): string {
  return Buffer.from(normalize(email), "utf8").toString("base64url");
}

export function decodeEmail(encoded: string): string | null {
  if (!ENCODED_EMAIL_RE.test(encoded)) return null;
  const email = Buffer.from(encoded, "base64url").toString("utf8");
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+$/.test(email)) return null;
  return email;
}

/** Handtekening voor een adres, of null zonder geheim (dan geen afmeldlink). */
export function signUnsubscribe(email: string, key: string | null = defaultKey()): string | null {
  if (!key) return null;
  return createHmac("sha256", key).update(PURPOSE + normalize(email)).digest("base64url");
}

/** Geldig paar (e, t) → het e-mailadres; anders null. Tijdconstant vergeleken. */
export function verifyUnsubscribe(
  encoded: string | null | undefined,
  token: string | null | undefined,
  key: string | null = defaultKey(),
): string | null {
  if (!encoded || !token || !TOKEN_RE.test(token)) return null;
  const email = decodeEmail(encoded);
  if (!email) return null;
  const expected = signUnsubscribe(email, key);
  if (!expected) return null;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? email : null;
}

function baseUrl(): string {
  return businessInfo.siteUrl.replace(/\/$/, "");
}

function query(email: string, key: string | null): string | null {
  const t = signUnsubscribe(email, key);
  return t ? `e=${encodeEmail(email)}&t=${t}` : null;
}

/** Link voor in de mailtekst (pagina met bevestigknop). */
export function unsubscribePageUrl(email: string, key: string | null = defaultKey()): string | null {
  const q = query(email, key);
  return q ? `${baseUrl()}/nieuwsbrief/afmelden?${q}` : null;
}

/**
 * List-Unsubscribe (+ -Post) voor elke nieuwsbriefmail. De https-URL is de
 * one-click-ingang (POST); mailto is de terugvaloptie voor oudere clients.
 * Let op: Gmail/Yahoo accepteren one-click alleen als de mail met DKIM is
 * ondertekend (instelling bij de SMTP-provider).
 */
export function listUnsubscribeHeaders(email: string, key: string | null = defaultKey()): Record<string, string> {
  const mailto = `<mailto:${businessInfo.contact.infoEmail}?subject=${encodeURIComponent("Afmelden nieuwsbrief")}>`;
  const q = query(email, key);
  if (!q) return { "List-Unsubscribe": mailto };
  return {
    "List-Unsubscribe": `<${baseUrl()}/api/newsletter/unsubscribe?${q}>, ${mailto}`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export type UnsubscribeOutcome = "done" | "invalid" | "error";
