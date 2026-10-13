import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { prisma } from "@/lib/prisma";
import { rateLimitIp } from "@/lib/rate-limit";
import { sendMail } from "@/lib/email";
import { captureError, captureWarning } from "@/lib/sentry";
import { submitContact } from "@/app/contact/actions";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/lib/rate-limit", () => ({ rateLimitIp: jest.fn() }));
jest.mock("@/lib/email", () => ({ sendMail: jest.fn(), INFO_EMAIL: "info@example.test" }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));

const db = asPrismaMock(prisma);

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Jan Jansen",
    email: "jan@example.com",
    message: "Is de hoekbank Milano ook in groen leverbaar?",
    website: "",
    elapsedMs: 12_000,
    ...overrides,
  };
}

describe("app/contact/actions · submitContact", () => {
  beforeEach(() => {
    jest.mocked(rateLimitIp).mockResolvedValue({ ok: true, retryAfter: 0 });
    jest.mocked(sendMail).mockResolvedValue(true);
    db.contactMessage.create.mockResolvedValue({ id: "msg_1" });
  });

  it("slaat een echt bericht op en stuurt het door naar info@ met reply-to van de klant", async () => {
    expect(await submitContact(validInput({ phone: "06 12345678", subject: "Hoekbank" }))).toEqual({ ok: true });
    expect(db.contactMessage.create).toHaveBeenCalledWith({
      data: {
        name: "Jan Jansen",
        email: "jan@example.com",
        subject: "Hoekbank",
        message: "Telefoon: 06 12345678\n\nIs de hoekbank Milano ook in groen leverbaar?",
      },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "info@example.test", subject: "Contactformulier: Hoekbank", replyTo: "jan@example.com" }),
    );
    expect(captureWarning).not.toHaveBeenCalled();
  });

  it("verwerkt een bericht ZONDER elapsedMs wél, maar logt het als verdacht (geen stille drop)", async () => {
    const input = validInput();
    delete input.elapsedMs;
    expect(await submitContact(input)).toEqual({ ok: true });
    expect(db.contactMessage.create).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(captureWarning).toHaveBeenCalledWith(expect.stringContaining("elapsedMs ontbreekt"), { hasStartedAt: false });
  });

  it("gebruikt een (afwijkend) startedAt-epoch niet meer als reden om te weigeren", async () => {
    // Klantklok 5 jaar vooruit: vroeger "binnen 3 s verstuurd" → stil weg.
    const input = validInput({ startedAt: Date.now() + 5 * 365 * 24 * 3600 * 1000 });
    delete input.elapsedMs;
    expect(await submitContact(input)).toEqual({ ok: true });
    expect(db.contactMessage.create).toHaveBeenCalledTimes(1);
    expect(captureWarning).toHaveBeenCalledWith(expect.stringContaining("elapsedMs ontbreekt"), { hasStartedAt: true });
  });

  it("negeert een gevulde honeypot: 'ok' terug, niets opgeslagen of gemaild, wél gelogd", async () => {
    expect(await submitContact(validInput({ website: "https://spam.example" }))).toEqual({ ok: true });
    expect(db.contactMessage.create).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(rateLimitIp).not.toHaveBeenCalled();
    expect(captureWarning).toHaveBeenCalledWith(expect.stringContaining("bot"), expect.objectContaining({ reason: "honeypot" }));
  });

  it("negeert een inzending die binnen 2,5 s (client-gemeten) is verstuurd", async () => {
    expect(await submitContact(validInput({ elapsedMs: 800 }))).toEqual({ ok: true });
    expect(db.contactMessage.create).not.toHaveBeenCalled();
    expect(captureWarning).toHaveBeenCalledWith(expect.stringContaining("bot"), expect.objectContaining({ reason: "too-fast", elapsedMs: 800 }));
  });

  it("accepteert precies 2500 ms en meer", async () => {
    expect(await submitContact(validInput({ elapsedMs: 2500 }))).toEqual({ ok: true });
    expect(db.contactMessage.create).toHaveBeenCalledTimes(1);
  });

  it("weigert ongeldige invoer met een leesbare melding, vóór rate-limit en database", async () => {
    expect(await submitContact(validInput({ name: "J" }))).toEqual({ ok: false, error: "Vul je naam in" });
    expect(await submitContact(validInput({ email: "geen-mail" }))).toEqual({ ok: false, error: "Ongeldig e-mailadres" });
    expect(await submitContact(validInput({ message: "hoi" }))).toEqual({ ok: false, error: "Schrijf een bericht" });
    expect(await submitContact(validInput({ name: "Jan\r\nBcc: x@y.z" }))).toEqual({ ok: false, error: "Ongeldige naam" });
    expect(await submitContact(validInput({ phone: "bel me" }))).toMatchObject({ ok: false, error: "Ongeldig telefoonnummer" });
    expect(rateLimitIp).not.toHaveBeenCalled();
    expect(db.contactMessage.create).not.toHaveBeenCalled();
  });

  it("weigert boven de rate-limit zonder opslag", async () => {
    jest.mocked(rateLimitIp).mockResolvedValue({ ok: false, retryAfter: 60 });
    expect(await submitContact(validInput())).toMatchObject({ ok: false, error: expect.stringContaining("Te veel berichten") });
    expect(rateLimitIp).toHaveBeenCalledWith("contact", 5, 10 * 60 * 1000);
    expect(db.contactMessage.create).not.toHaveBeenCalled();
  });

  it("geeft een generieke fout als opslaan mislukt en mailt dan niet", async () => {
    db.contactMessage.create.mockRejectedValue(new Error("DB weg"));
    expect(await submitContact(validInput())).toMatchObject({ ok: false, error: expect.stringContaining("Er ging iets mis") });
    expect(sendMail).not.toHaveBeenCalled();
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { scope: "submitContact" });
  });

  it("laat een mislukte mail de inzending niet verloren gaan (DB-opslag telt)", async () => {
    jest.mocked(sendMail).mockResolvedValue(false);
    expect(await submitContact(validInput())).toEqual({ ok: true });
    expect(db.contactMessage.create).toHaveBeenCalledTimes(1);
  });
});
