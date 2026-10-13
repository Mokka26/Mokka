import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";
import { sendNewsletterConfirmation } from "@/lib/email";
import { captureWarning } from "@/lib/sentry";
import { subscribeNewsletter } from "@/app/newsletter/actions";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/lib/rate-limit", () => ({ rateLimit: jest.fn(), rateLimitIp: jest.fn() }));
jest.mock("@/lib/email", () => ({ sendNewsletterConfirmation: jest.fn() }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));

const db = asPrismaMock(prisma);

describe("app/newsletter/actions · subscribeNewsletter", () => {
  beforeEach(() => {
    jest.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 });
    jest.mocked(rateLimitIp).mockResolvedValue({ ok: true, retryAfter: 0 });
    jest.mocked(sendNewsletterConfirmation).mockResolvedValue(true);
    db.newsletterSubscriber.findUnique.mockResolvedValue(null);
    db.newsletterSubscriber.upsert.mockResolvedValue({});
  });

  it("maakt een token + confirmTokenAt aan en mailt een bevestigingslink", async () => {
    expect(await subscribeNewsletter({ email: "Jan@Example.com", website: "", elapsedMs: 4000 })).toEqual({ ok: true });
    const upsert = db.newsletterSubscriber.upsert.mock.calls[0][0] as {
      where: { email: string };
      create: { email: string; confirmToken: string; confirmTokenAt: Date };
      update: { confirmToken: string; confirmTokenAt: Date };
    };
    expect(upsert.where).toEqual({ email: "jan@example.com" });
    expect(upsert.create.confirmToken).toMatch(/^[a-f0-9]{48}$/);
    expect(upsert.create.confirmTokenAt).toBeInstanceOf(Date);
    expect(upsert.update.confirmToken).toBe(upsert.create.confirmToken);
    expect(sendNewsletterConfirmation).toHaveBeenCalledWith(
      "jan@example.com",
      expect.stringMatching(new RegExp(`/nieuwsbrief/bevestigen\\?token=${upsert.create.confirmToken}$`)),
    );
    expect(captureWarning).not.toHaveBeenCalled();
  });

  it("blijft werken met alleen een e-mailadres (legacy-aanroep), met een waarschuwing over elapsedMs", async () => {
    expect(await subscribeNewsletter("jan@example.com")).toEqual({ ok: true });
    expect(db.newsletterSubscriber.upsert).toHaveBeenCalledTimes(1);
    expect(captureWarning).toHaveBeenCalledWith(expect.stringContaining("elapsedMs ontbreekt"), { hasStartedAt: false });
  });

  it("negeert bots (honeypot of < 2,5 s) met 'ok', zonder opslag of mail, en logt dat", async () => {
    expect(await subscribeNewsletter({ email: "jan@example.com", website: "x" })).toEqual({ ok: true });
    expect(await subscribeNewsletter({ email: "jan@example.com", elapsedMs: 300 })).toEqual({ ok: true });
    expect(db.newsletterSubscriber.upsert).not.toHaveBeenCalled();
    expect(sendNewsletterConfirmation).not.toHaveBeenCalled();
    expect(captureWarning).toHaveBeenCalledWith(expect.stringContaining("bot"), expect.objectContaining({ reason: "honeypot" }));
    expect(captureWarning).toHaveBeenCalledWith(expect.stringContaining("bot"), expect.objectContaining({ reason: "too-fast" }));
  });

  it("verraadt niet wie al bevestigd op de lijst staat (zelfde 'ok', geen mail)", async () => {
    db.newsletterSubscriber.findUnique.mockResolvedValue({ email: "jan@example.com", confirmedAt: new Date(), unsubscribedAt: null });
    expect(await subscribeNewsletter({ email: "jan@example.com", elapsedMs: 5000 })).toEqual({ ok: true });
    expect(db.newsletterSubscriber.upsert).not.toHaveBeenCalled();
    expect(sendNewsletterConfirmation).not.toHaveBeenCalled();
  });

  it("geeft een uitgeschreven adres een nieuw token (her-aanmelding)", async () => {
    db.newsletterSubscriber.findUnique.mockResolvedValue({ email: "jan@example.com", confirmedAt: new Date("2025-01-01"), unsubscribedAt: new Date("2025-06-01") });
    expect(await subscribeNewsletter({ email: "jan@example.com", elapsedMs: 5000 })).toEqual({ ok: true });
    expect(db.newsletterSubscriber.upsert).toHaveBeenCalledTimes(1);
    expect(sendNewsletterConfirmation).toHaveBeenCalledTimes(1);
  });

  it("weigert per IP én per adres boven de limiet", async () => {
    jest.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 60 });
    expect(await subscribeNewsletter({ email: "jan@example.com", elapsedMs: 5000 })).toMatchObject({ ok: false });
    expect(rateLimit).toHaveBeenCalledWith("newsletter:email:jan@example.com", 3, 60 * 60 * 1000);
    expect(rateLimitIp).toHaveBeenCalledWith("newsletter", 5, 10 * 60 * 1000);
    expect(db.newsletterSubscriber.upsert).not.toHaveBeenCalled();
  });

  it("meldt het als de bevestigingsmail niet verstuurd kon worden", async () => {
    jest.mocked(sendNewsletterConfirmation).mockResolvedValue(false);
    expect(await subscribeNewsletter({ email: "jan@example.com", elapsedMs: 5000 })).toMatchObject({ ok: false, error: expect.stringContaining("bevestigingsmail") });
  });

  it("weigert een ongeldig adres", async () => {
    expect(await subscribeNewsletter("geen-mail")).toEqual({ ok: false, error: "Vul een geldig e-mailadres in" });
    expect(rateLimitIp).not.toHaveBeenCalled();
  });
});
