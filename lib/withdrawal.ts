import { businessInfo, getFullAddress } from "@/lib/business-info";

/**
 * Wettelijk modelformulier voor herroeping (Bijlage I bij art. 6:230m BW), één
 * bron voor de orderbevestiging (lib/email.ts) en de pagina /retourneren.
 */
export const WITHDRAWAL_FORM_TITLE = "Modelformulier voor herroeping";

export function withdrawalFormLines(): string[] {
  return [
    "(dit formulier alleen invullen en terugzenden als je de overeenkomst wilt herroepen)",
    `— Aan: ${businessInfo.legalName}, ${getFullAddress()}, ${businessInfo.contact.email}`,
    "— Ik/Wij* deel/delen* u hierbij mede dat ik/wij* onze overeenkomst betreffende de verkoop van de volgende producten herroep/herroepen*:",
    "— Besteld op*/Ontvangen op*:",
    "— Naam/Namen consument(en):",
    "— Adres consument(en):",
    "— Handtekening van consument(en) (alleen wanneer dit formulier op papier wordt ingediend):",
    "— Datum:",
    "* Doorhalen wat niet van toepassing is.",
  ];
}
