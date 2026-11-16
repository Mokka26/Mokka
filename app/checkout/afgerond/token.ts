/**
 * De bedank-URL van Mollie bevat `?t=<publicToken>`. Die token mag niet in
 * analytics (GA4 page_location), de browsergeschiedenis of gedeelde links
 * belanden. Daarom halen we hem vóór de meting uit de adresbalk en bewaren we
 * hem in een kortlevende cookie (alleen voor dit pad), zodat verversen
 * (AutoRefresh, F5) de order nog steeds vindt.
 */
export const ORDER_TOKEN_COOKIE = "mokka_order_t";
export const ORDER_TOKEN_RE = /^[a-f0-9]{32}$/;
const COOKIE_MAX_AGE_S = 24 * 60 * 60;
const COOKIE_PATH = "/checkout/afgerond";

/**
 * Inline script (draait tijdens het parsen van de HTML, dus vóór gtag.js en
 * vóór hydratatie): token uit de URL → cookie, daarna replaceState zonder `t`.
 * Bevat geen gebruikersdata: de token wordt in de browser uit de URL gelezen.
 */
export function stripTokenScript(): string {
  return `(function(){try{var u=new URL(window.location.href);var t=u.searchParams.get("t");if(!t)return;if(${ORDER_TOKEN_RE.toString()}.test(t)){document.cookie=${JSON.stringify(`${ORDER_TOKEN_COOKIE}=`)}+t+${JSON.stringify(`; path=${COOKIE_PATH}; max-age=${COOKIE_MAX_AGE_S}; samesite=lax`)}+(window.location.protocol==="https:"?"; secure":"");}u.searchParams.delete("t");window.history.replaceState(window.history.state,"",u.pathname+u.search+u.hash);}catch(e){}})();`;
}

/** Zelfde stap vanuit React (vangnet als het inline script niet draaide). */
export function stripTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("t");
    if (!t) return;
    if (ORDER_TOKEN_RE.test(t)) {
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${ORDER_TOKEN_COOKIE}=${t}; path=${COOKIE_PATH}; max-age=${COOKIE_MAX_AGE_S}; samesite=lax${secure}`;
    }
    url.searchParams.delete("t");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    // Geen URL-API of geen cookies: de pagina werkt nog, alleen met token in de URL.
  }
}
