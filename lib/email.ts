import nodemailer, { type Transporter } from "nodemailer";
import { businessInfo, getFullAddress } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { captureError } from "@/lib/sentry";

/**
 * E-mail via SMTP (server-only). Afzender en interne ontvanger zijn
 * businessInfo.contact.infoEmail (info@) — formulieren komen dáár binnen en
 * bevestigingen gaan er vandaan.
 *
 * Vereiste env-vars (Vercel → Settings → Environment Variables):
 *   SMTP_HOST  — bv. smtp.transip.email / smtp.office365.com
 *   SMTP_PORT  — 465 (SSL, default) of 587 (STARTTLS)
 *   SMTP_USER  — meestal info@mokkahomeinteriors.nl
 *   SMTP_PASS  — het (app-)wachtwoord
 *
 * Zonder deze vars wordt verzenden overgeslagen (sendMail → false, met een
 * waarschuwing in Sentry): formulieren en de betaal-flow blijven altijd werken.
 * De orderbevestiging wordt via confirmationSentAt + de reconcile-cron alsnog
 * opnieuw geprobeerd zodra SMTP werkt.
 */

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    transporter = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = impliciete SSL; 587 gebruikt STARTTLS
    auth: { user, pass },
  });
  return transporter;
}

export const INFO_EMAIL = businessInfo.contact.infoEmail;

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

let warnedMissingSmtp = false;

/**
 * Verstuur een mail. Retourneert false (nooit een throw) als het niet lukt;
 * de fout gaat naar Sentry zodat een stille SMTP-storing niet onopgemerkt blijft.
 */
export async function sendMail({ to, subject, text, html, replyTo }: MailInput): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    if (!warnedMissingSmtp) {
      warnedMissingSmtp = true;
      captureError(new Error("SMTP niet geconfigureerd — mail overgeslagen"), { subject });
    }
    return false;
  }
  try {
    await t.sendMail({
      from: `"${businessInfo.name}" <${INFO_EMAIL}>`,
      to,
      subject: sanitizeHeader(subject),
      text,
      ...(html ? { html } : {}),
      ...(replyTo ? { replyTo: sanitizeHeader(replyTo) } : {}),
    });
    return true;
  } catch (e) {
    captureError(e, { scope: "sendMail", to: maskEmail(to), subject });
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Header-injectie (CR/LF) onmogelijk maken, ongeacht wat de aanroeper doorgeeft. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** k***@domein.nl — voor logging en de bedankpagina. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

const eur = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;

const phoneLine = businessInfo.contact.phoneFormatted ? ` of bel ${businessInfo.contact.phoneFormatted}` : "";

/**
 * Eenvoudige huisstijl-wrapper: tekstlogo, inhoud, footer met adres en
 * telefoon. Inline-styles zijn in e-mail de enige betrouwbare optie (geen
 * Tailwind) — kleuren komen overeen met de tokens in globals.css.
 */
function layout(title: string, bodyHtml: string): string {
  const phone = businessInfo.contact.phoneFormatted
    ? `<a href="tel:${businessInfo.contact.phone}" style="color:#14110D;text-decoration:none">${escapeHtml(businessInfo.contact.phoneFormatted)}</a>`
    : "";
  return `<!doctype html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F4F0E8;font-family:Georgia,'Times New Roman',serif;color:#3D3D3D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F0E8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FBF9F4;border:1px solid #E5E1D9;">
        <tr><td style="padding:28px 32px 8px 32px;font-size:22px;letter-spacing:0.08em;text-transform:uppercase;color:#14110D;">${escapeHtml(businessInfo.name)}</td></tr>
        <tr><td style="padding:8px 32px 32px 32px;font-size:17px;line-height:1.6;color:#3D3D3D;">${bodyHtml}</td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #E5E1D9;font-size:14px;line-height:1.6;color:#5A5854;">
          ${escapeHtml(businessInfo.legalName)} · ${escapeHtml(getFullAddress())}<br>
          ${phone}${phone ? " · " : ""}<a href="mailto:${businessInfo.contact.email}" style="color:#14110D;text-decoration:none">${escapeHtml(businessInfo.contact.email)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:28px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#14110D;color:#F4F0E8;padding:14px 28px;text-decoration:none;font-size:16px;">${escapeHtml(label)}</a></p>`;

const h1 = (text: string) => `<h1 style="font-size:26px;line-height:1.3;font-weight:normal;color:#14110D;margin:0 0 20px 0;">${escapeHtml(text)}</h1>`;
const p = (html: string) => `<p style="margin:0 0 16px 0;">${html}</p>`;

// Concrete vervolgstap na betaling — één bron, gebruikt in mail en bedankpagina.
export const NEXT_STEP_AFTER_PAYMENT =
  "We bellen of mailen je binnen 2 werkdagen om de bezorging in te plannen.";

// ─── Templates ──────────────────────────────────────────────────────

export type OrderMailData = {
  orderNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  country?: string | null;
  total: number;
  shipping: number;
  paymentMethod?: string | null;
  items: { productName: string; variantLabel: string | null; quantity: number; price: number }[];
};

function orderLinesText(order: OrderMailData): string {
  return order.items
    .map((it) => `  ${it.quantity}× ${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ""} — ${eur(it.price * it.quantity)}`)
    .join("\n");
}

function orderLinesHtml(order: OrderMailData): string {
  const rows = order.items
    .map(
      (it) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #E5E1D9;">${it.quantity}× ${escapeHtml(it.productName)}${it.variantLabel ? `<br><span style="color:#6B675F;font-size:14px;">${escapeHtml(it.variantLabel)}</span>` : ""}</td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #E5E1D9;white-space:nowrap;">${eur(it.price * it.quantity)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:16px;margin:16px 0;">
    ${rows}
    <tr><td style="padding:8px 0;">Verzending</td><td align="right" style="padding:8px 0;">${order.shipping === 0 ? "Gratis" : eur(order.shipping)}</td></tr>
    <tr><td style="padding:8px 0;color:#14110D;"><strong>Totaal (${shippingInfo.vatLabelShort})</strong></td><td align="right" style="padding:8px 0;color:#14110D;"><strong>${eur(order.total)}</strong></td></tr>
  </table>`;
}

function addressBlock(order: OrderMailData): string[] {
  const countryName = order.country === "BE" ? "België" : businessInfo.address.countryName;
  return [`${order.firstName} ${order.lastName}`, `${order.address} ${order.houseNumber}`, `${order.zipCode} ${order.city}`, countryName];
}
function addressText(order: OrderMailData): string {
  return addressBlock(order).map((l) => `  ${l}`).join("\n");
}
function addressHtml(order: OrderMailData): string {
  return addressBlock(order).map(escapeHtml).join("<br>");
}

/**
 * Orderbevestiging naar de klant + interne kopie naar info@.
 * Retourneert true als de KLANT-mail is verstuurd (de interne kopie is
 * best-effort en telt niet mee voor confirmationSentAt).
 */
export async function sendOrderConfirmation(order: OrderMailData): Promise<boolean> {
  const lines = orderLinesText(order);
  const text = [
    `Beste ${order.firstName},`,
    ``,
    `Bedankt voor je bestelling bij ${businessInfo.name}! We hebben je betaling ontvangen.`,
    ``,
    `Bestelnummer: ${order.orderNumber}`,
    ``,
    `Jouw bestelling:`,
    lines,
    ``,
    `Verzending: ${order.shipping === 0 ? "Gratis" : eur(order.shipping)}`,
    `Totaal (${shippingInfo.vatLabelShort}): ${eur(order.total)}`,
    ``,
    `Bezorgadres:`,
    addressText(order),
    ``,
    `Hoe nu verder?`,
    NEXT_STEP_AFTER_PAYMENT,
    ``,
    `Vragen? Mail naar ${businessInfo.contact.email}${phoneLine}.`,
    ``,
    `Hartelijke groet,`,
    businessInfo.name,
  ].join("\n");

  const html = layout(`Bevestiging van je bestelling ${order.orderNumber}`, [
    h1("Bedankt voor je bestelling"),
    p(`Beste ${escapeHtml(order.firstName)},`),
    p(`We hebben je betaling ontvangen. Je bestelnummer is <strong style="color:#14110D;">${escapeHtml(order.orderNumber)}</strong> — handig om bij de hand te hebben als je ons belt of mailt.`),
    orderLinesHtml(order),
    p(`<strong style="color:#14110D;">Bezorgadres</strong><br>${addressHtml(order)}`),
    p(`<strong style="color:#14110D;">Hoe nu verder?</strong><br>${escapeHtml(NEXT_STEP_AFTER_PAYMENT)}`),
    p(`Vragen? Mail naar <a href="mailto:${businessInfo.contact.email}" style="color:#14110D;">${escapeHtml(businessInfo.contact.email)}</a>${escapeHtml(phoneLine)}.`),
    p(`Hartelijke groet,<br>${escapeHtml(businessInfo.name)}`),
  ].join(""));

  const sent = await sendMail({
    to: order.email,
    subject: `Bevestiging van je bestelling ${order.orderNumber} — ${businessInfo.name}`,
    text,
    html,
  });

  // Interne notificatie (best-effort, apart van het klantresultaat).
  await sendMail({
    to: INFO_EMAIL,
    subject: `Nieuwe bestelling ${order.orderNumber} — ${eur(order.total)}`,
    text: [
      `Nieuwe betaalde bestelling van ${order.firstName} ${order.lastName} <${order.email}>`,
      ...(order.paymentMethod ? [`Betaalmethode: ${order.paymentMethod}`] : []),
      ``,
      lines,
      ``,
      `Totaal: ${eur(order.total)}`,
      `Adres:`,
      addressText(order),
    ].join("\n"),
    replyTo: order.email,
  });
  return sent;
}

export type ShippingMailData = {
  orderNumber: string;
  email: string;
  firstName: string;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  items?: { productName: string; variantLabel: string | null; quantity: number }[];
};

/**
 * Verzendbevestiging — aan te roepen door de admin bij "verzonden" (met
 * trackingCode/-Url als die er zijn). Retourneert true bij succes.
 */
export async function sendShippingConfirmation(order: ShippingMailData): Promise<boolean> {
  const itemsText = order.items?.length
    ? order.items.map((it) => `  ${it.quantity}× ${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ""}`).join("\n")
    : "";
  const trackingText = order.trackingUrl
    ? `Volg je zending: ${order.trackingUrl}${order.trackingCode ? ` (code ${order.trackingCode})` : ""}`
    : order.trackingCode
      ? `Track & trace-code: ${order.trackingCode}`
      : "";

  const text = [
    `Beste ${order.firstName},`,
    ``,
    `Goed nieuws: je bestelling ${order.orderNumber} is onderweg.`,
    ``,
    itemsText ? `Wat er komt:\n${itemsText}\n` : "",
    trackingText,
    trackingText ? `` : "",
    `Vragen over de bezorging? Mail naar ${businessInfo.contact.email}${phoneLine}.`,
    ``,
    `Hartelijke groet,`,
    businessInfo.name,
  ].filter((l) => l !== "").join("\n");

  const html = layout(`Je bestelling ${order.orderNumber} is onderweg`, [
    h1("Je bestelling is onderweg"),
    p(`Beste ${escapeHtml(order.firstName)},`),
    p(`Goed nieuws: je bestelling <strong style="color:#14110D;">${escapeHtml(order.orderNumber)}</strong> is verzonden.`),
    order.items?.length
      ? p(`<strong style="color:#14110D;">Wat er komt</strong><br>${order.items.map((it) => `${it.quantity}× ${escapeHtml(it.productName)}${it.variantLabel ? ` (${escapeHtml(it.variantLabel)})` : ""}`).join("<br>")}`)
      : "",
    order.trackingUrl
      ? button(order.trackingUrl, "Volg je zending") + (order.trackingCode ? p(`Track & trace-code: <strong style="color:#14110D;">${escapeHtml(order.trackingCode)}</strong>`) : "")
      : order.trackingCode
        ? p(`Track & trace-code: <strong style="color:#14110D;">${escapeHtml(order.trackingCode)}</strong>`)
        : "",
    p(`Vragen over de bezorging? Mail naar <a href="mailto:${businessInfo.contact.email}" style="color:#14110D;">${escapeHtml(businessInfo.contact.email)}</a>${escapeHtml(phoneLine)}.`),
    p(`Hartelijke groet,<br>${escapeHtml(businessInfo.name)}`),
  ].join(""));

  return sendMail({
    to: order.email,
    subject: `Je bestelling ${order.orderNumber} is onderweg — ${businessInfo.name}`,
    text,
    html,
  });
}

/** Double opt-in: bevestigingslink voor de nieuwsbrief. */
export async function sendNewsletterConfirmation(email: string, confirmUrl: string): Promise<boolean> {
  const text = [
    `Bedankt voor je aanmelding voor de nieuwsbrief van ${businessInfo.name}.`,
    ``,
    `Bevestig je aanmelding via deze link:`,
    confirmUrl,
    ``,
    `Heb je je niet aangemeld? Dan kun je deze mail negeren — zonder bevestiging ontvang je niets van ons.`,
    ``,
    `Hartelijke groet,`,
    businessInfo.name,
  ].join("\n");
  const html = layout("Bevestig je aanmelding", [
    h1("Bevestig je aanmelding"),
    p(`Bedankt voor je aanmelding voor de nieuwsbrief van ${escapeHtml(businessInfo.name)}. Klik op de knop om je aanmelding te bevestigen.`),
    button(confirmUrl, "Aanmelding bevestigen"),
    p(`<span style="color:#6B675F;font-size:14px;">Werkt de knop niet? Kopieer deze link: ${escapeHtml(confirmUrl)}</span>`),
    p(`Heb je je niet aangemeld? Dan kun je deze mail negeren — zonder bevestiging ontvang je niets van ons.`),
  ].join(""));
  return sendMail({ to: email, subject: `Bevestig je aanmelding — ${businessInfo.name}`, text, html });
}

/** Welkomstmail na bevestiging. */
export async function sendNewsletterWelcome(email: string): Promise<boolean> {
  const text = [
    `Welkom bij de nieuwsbrief van ${businessInfo.name}!`,
    ``,
    `Je aanmelding is bevestigd. Je ontvangt af en toe bericht over nieuwe collecties, showroomnieuws en aanbiedingen — niet vaker dan nodig.`,
    ``,
    `Showroom: ${getFullAddress()}`,
    `Vragen? Mail naar ${businessInfo.contact.email}${phoneLine}.`,
    ``,
    `Hartelijke groet,`,
    businessInfo.name,
  ].join("\n");
  const html = layout("Welkom", [
    h1("Welkom"),
    p(`Je aanmelding is bevestigd. Je ontvangt af en toe bericht over nieuwe collecties, showroomnieuws en aanbiedingen — niet vaker dan nodig.`),
    p(`Kom je langs? Onze showroom vind je aan ${escapeHtml(getFullAddress())}.`),
    button(`${businessInfo.siteUrl}/products`, "Bekijk de collectie"),
    p(`Hartelijke groet,<br>${escapeHtml(businessInfo.name)}`),
  ].join(""));
  return sendMail({ to: email, subject: `Welkom bij ${businessInfo.name}`, text, html });
}
