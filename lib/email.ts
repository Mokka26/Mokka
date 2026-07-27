import nodemailer, { type Transporter } from "nodemailer";
import { businessInfo } from "@/lib/business-info";

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
 * Zonder deze vars wordt verzenden stil overgeslagen (sendMail → false):
 * formulieren en de betaal-flow blijven altijd werken — mail is best-effort.
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

/** Verstuur een mail. Retourneert false (nooit een throw) als het niet lukt. */
export async function sendMail({ to, subject, text, html, replyTo }: MailInput): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: `"${businessInfo.name}" <${INFO_EMAIL}>`,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
    return true;
  } catch (e) {
    console.error("sendMail:", e instanceof Error ? e.message : e);
    return false;
  }
}

const eur = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;

/** Orderbevestiging naar de klant + interne kopie naar info@. */
export async function sendOrderConfirmation(order: {
  orderNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  total: number;
  shipping: number;
  items: { productName: string; variantLabel: string | null; quantity: number; price: number }[];
}): Promise<void> {
  const lines = order.items
    .map((it) => `  ${it.quantity}× ${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ""} — ${eur(it.price * it.quantity)}`)
    .join("\n");
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
    `Totaal (incl. btw): ${eur(order.total)}`,
    ``,
    `Bezorgadres:`,
    `  ${order.firstName} ${order.lastName}`,
    `  ${order.address} ${order.houseNumber}`,
    `  ${order.zipCode} ${order.city}`,
    ``,
    `We nemen contact met je op om de bezorging in te plannen.`,
    ``,
    `Vragen? Mail naar ${businessInfo.contact.email}${businessInfo.contact.phoneFormatted ? ` of bel ${businessInfo.contact.phoneFormatted}` : ""}.`,
    ``,
    `Hartelijke groet,`,
    businessInfo.name,
  ].join("\n");

  // Klant-bevestiging + interne notificatie; beide best-effort.
  await sendMail({
    to: order.email,
    subject: `Bevestiging van je bestelling ${order.orderNumber} — ${businessInfo.name}`,
    text,
  });
  await sendMail({
    to: INFO_EMAIL,
    subject: `🛒 Nieuwe bestelling ${order.orderNumber} — ${eur(order.total)}`,
    text: `Nieuwe betaalde bestelling van ${order.firstName} ${order.lastName} <${order.email}>\n\n${lines}\n\nTotaal: ${eur(order.total)}\nAdres: ${order.address} ${order.houseNumber}, ${order.zipCode} ${order.city}`,
    replyTo: order.email,
  });
}
