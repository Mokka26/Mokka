/**
 * Serialiseer een JSON-LD object veilig voor inline <script type="application/ld+json">.
 *
 * Escapet `<` naar `<` zodat een productnaam/-beschrijving met een
 * `</script>`-sequentie niet uit het script-blok kan breken (XSS-hardening).
 * Gebruik altijd dit i.p.v. kale JSON.stringify in dangerouslySetInnerHTML.
 */
export function jsonLdHtml(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}
