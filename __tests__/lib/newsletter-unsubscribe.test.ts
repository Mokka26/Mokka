import {
  decodeEmail,
  encodeEmail,
  listUnsubscribeHeaders,
  signUnsubscribe,
  unsubscribePageUrl,
  verifyUnsubscribe,
} from "@/lib/newsletter-unsubscribe";
import { newsletterUnsubscribe } from "@/lib/email";

const KEY = "test-secret-voor-afmeldlinks-0123456789";

describe("lib/newsletter-unsubscribe", () => {
  it("codeert en decodeert het adres (genormaliseerd)", () => {
    const e = encodeEmail(" Jan@Example.com ");
    expect(e).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeEmail(e)).toBe("jan@example.com");
    expect(decodeEmail("!!")).toBeNull();
    expect(decodeEmail(Buffer.from("geen-adres").toString("base64url"))).toBeNull();
  });

  it("accepteert een eigen handtekening en weigert een vervalste", () => {
    const t = signUnsubscribe("jan@example.com", KEY);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const e = encodeEmail("jan@example.com");
    expect(verifyUnsubscribe(e, t, KEY)).toBe("jan@example.com");
    // Ander adres met dezelfde handtekening
    expect(verifyUnsubscribe(encodeEmail("piet@example.com"), t, KEY)).toBeNull();
    // Andere sleutel
    expect(verifyUnsubscribe(e, t, "andere-sleutel-0123456789-abcdefghij")).toBeNull();
    // Rommel
    expect(verifyUnsubscribe(e, "x".repeat(43), KEY)).toBeNull();
    expect(verifyUnsubscribe(e, null, KEY)).toBeNull();
    expect(verifyUnsubscribe(undefined, t, KEY)).toBeNull();
  });

  it("geeft zonder geheim geen link en alleen een mailto-header", () => {
    expect(signUnsubscribe("jan@example.com", null)).toBeNull();
    expect(unsubscribePageUrl("jan@example.com", null)).toBeNull();
    const h = listUnsubscribeHeaders("jan@example.com", null);
    expect(h["List-Unsubscribe"]).toMatch(/^<mailto:/);
    expect(h["List-Unsubscribe-Post"]).toBeUndefined();
  });

  it("bouwt pagina-URL en RFC 8058-headers met hetzelfde token", () => {
    const url = unsubscribePageUrl("jan@example.com", KEY);
    expect(url).toMatch(/\/nieuwsbrief\/afmelden\?e=[A-Za-z0-9_-]+&t=[A-Za-z0-9_-]{43}$/);
    const h = listUnsubscribeHeaders("jan@example.com", KEY);
    expect(h["List-Unsubscribe"]).toMatch(/^<https?:\/\/[^>]+\/api\/newsletter\/unsubscribe\?e=[^>]+>, <mailto:/);
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("lib/email · newsletterUnsubscribe", () => {
  const prev = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = KEY;
  });
  afterAll(() => {
    process.env.AUTH_SECRET = prev;
  });

  it("zet een afmeldlink in tekst en html en geeft de headers mee", () => {
    const u = newsletterUnsubscribe("jan@example.com");
    expect(u.text.join("\n")).toContain("/nieuwsbrief/afmelden?e=");
    expect(u.html).toContain("Meld je hier af");
    expect(u.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
