"use server";

import { redirect } from "next/navigation";
import { unsubscribeBySignedLink } from "@/lib/newsletter-unsubscribe-db";

/**
 * Afmelden via de knop op /nieuwsbrief/afmelden (POST; werkt ook zonder
 * JavaScript). Redirect naar dezelfde pagina met `?done=<uitkomst>`.
 */
export async function unsubscribeNewsletter(formData: FormData): Promise<void> {
  const e = formData.get("e");
  const t = formData.get("t");
  const outcome = await unsubscribeBySignedLink(
    typeof e === "string" ? e : null,
    typeof t === "string" ? t : null,
    { scope: "newsletter-unsubscribe", limit: 10 },
  );
  redirect(`/nieuwsbrief/afmelden?done=${outcome}`);
}
