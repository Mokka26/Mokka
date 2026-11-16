import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { rateLimitIp } from "@/lib/rate-limit";
import { encodeEmail, signUnsubscribe } from "@/lib/newsletter-unsubscribe";
import { GET, POST } from "@/app/api/newsletter/unsubscribe/route";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/lib/rate-limit", () => ({ rateLimitIp: jest.fn() }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));

const db = asPrismaMock(prisma);
const KEY = "test-secret-voor-afmeldlinks-0123456789";
const prev = process.env.AUTH_SECRET;

function url(email: string, token?: string | null): string {
  const t = token === undefined ? signUnsubscribe(email, KEY) : token;
  return `http://localhost:3000/api/newsletter/unsubscribe?e=${encodeEmail(email)}${t ? `&t=${t}` : ""}`;
}

beforeAll(() => {
  process.env.AUTH_SECRET = KEY;
});
afterAll(() => {
  process.env.AUTH_SECRET = prev;
});
beforeEach(() => {
  jest.mocked(rateLimitIp).mockResolvedValue({ ok: true, retryAfter: 0 });
  db.newsletterSubscriber.updateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/newsletter/unsubscribe (one-click)", () => {
  it("meldt af met een geldige handtekening", async () => {
    const res = await POST(new NextRequest(url("jan@example.com"), { method: "POST", body: "List-Unsubscribe=One-Click" }));
    expect(res.status).toBe(200);
    expect(db.newsletterSubscriber.updateMany).toHaveBeenCalledWith({
      where: { email: "jan@example.com", unsubscribedAt: null },
      data: expect.objectContaining({ unsubscribedAt: expect.any(Date), confirmToken: null }),
    });
  });

  it("weigert een vervalste link zonder databasewerk", async () => {
    const res = await POST(new NextRequest(url("jan@example.com", "a".repeat(43)), { method: "POST" }));
    expect(res.status).toBe(400);
    expect(rateLimitIp).not.toHaveBeenCalled();
    expect(db.newsletterSubscriber.updateMany).not.toHaveBeenCalled();
  });

  it("respecteert de rate limit", async () => {
    jest.mocked(rateLimitIp).mockResolvedValue({ ok: false, retryAfter: 60 });
    const res = await POST(new NextRequest(url("jan@example.com"), { method: "POST" }));
    expect(res.status).toBe(503);
    expect(db.newsletterSubscriber.updateMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/newsletter/unsubscribe", () => {
  it("stuurt door naar de afmeldpagina zonder iets te wijzigen", async () => {
    const res = GET(new NextRequest(url("jan@example.com")));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/nieuwsbrief/afmelden?e=");
    expect(db.newsletterSubscriber.updateMany).not.toHaveBeenCalled();
  });
});
