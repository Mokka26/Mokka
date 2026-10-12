import { headers } from "next/headers";
import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/sentry";
import { rateLimit, rateLimitIp, clientIp } from "@/lib/rate-limit";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn() }));
jest.mock("next/headers", () => ({ headers: jest.fn() }));

const db = asPrismaMock(prisma);

function nextHeaders(init: Record<string, string>): void {
  jest.mocked(headers).mockResolvedValue(new Headers(init) as unknown as Awaited<ReturnType<typeof headers>>);
}

describe("lib/rate-limit", () => {
  describe("rateLimit", () => {
    it("laat de aanvraag door onder de limiet", async () => {
      db.$queryRaw.mockResolvedValue([{ count: 3, resetAt: new Date(Date.now() + 60_000) }]);
      expect(await rateLimit("contact:ip:1.2.3.4", 5, 60_000)).toEqual({ ok: true, retryAfter: 0 });
      expect(await rateLimit("contact:ip:1.2.3.4", 3, 60_000)).toEqual({ ok: true, retryAfter: 0 });
    });

    it("weigert boven de limiet met retryAfter in seconden tot het venster sluit", async () => {
      db.$queryRaw.mockResolvedValue([{ count: 6, resetAt: new Date(Date.now() + 45_000) }]);
      const result = await rateLimit("contact:ip:1.2.3.4", 5, 60_000);
      expect(result.ok).toBe(false);
      expect(result.retryAfter).toBeGreaterThanOrEqual(44);
      expect(result.retryAfter).toBeLessThanOrEqual(46);
    });

    it("geeft minimaal 1 seconde retryAfter als het venster bijna om is", async () => {
      db.$queryRaw.mockResolvedValue([{ count: 99, resetAt: new Date(Date.now() - 1) }]);
      expect(await rateLimit("k", 1, 60_000)).toEqual({ ok: false, retryAfter: 1 });
    });

    it("doet één atomaire upsert met de sleutel", async () => {
      db.$queryRaw.mockResolvedValue([{ count: 1, resetAt: new Date() }]);
      await rateLimit("login:ip:9.9.9.9", 5, 1000);
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
      const [strings, ...values] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(strings.join("?")).toMatch(/INSERT INTO "RateLimit"[\s\S]*ON CONFLICT \("key"\) DO UPDATE/);
      expect(values[0]).toBe("login:ip:9.9.9.9");
    });

    it("faalt open bij een databasefout (default) en meldt het", async () => {
      db.$queryRaw.mockRejectedValue(new Error("P1001"));
      expect(await rateLimit("contact:ip:1.2.3.4", 5, 60_000)).toEqual({ ok: true, retryAfter: 0 });
      expect(captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ scope: "rateLimit", key: "contact:ip", failClosed: false }),
      );
    });

    it("faalt gesloten met failClosed: true", async () => {
      db.$queryRaw.mockRejectedValue(new Error("P1001"));
      expect(await rateLimit("login:ip:1.2.3.4", 5, 60_000, { failClosed: true })).toEqual({ ok: false, retryAfter: 60 });
      expect(captureError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ failClosed: true }));
    });

    it("behandelt een lege resultaatset als storing", async () => {
      db.$queryRaw.mockResolvedValue([]);
      expect(await rateLimit("k", 5, 60_000)).toEqual({ ok: true, retryAfter: 0 });
      expect(captureError).toHaveBeenCalledTimes(1);
    });
  });

  describe("clientIp", () => {
    it("geeft x-real-ip voorrang, dan de eerste x-forwarded-for, anders unknown", async () => {
      expect(await clientIp(new Headers({ "x-real-ip": "10.0.0.1", "x-forwarded-for": "8.8.8.8, 10.0.0.2" }))).toBe("10.0.0.1");
      expect(await clientIp(new Headers({ "x-forwarded-for": " 8.8.8.8 , 10.0.0.2" }))).toBe("8.8.8.8");
      expect(await clientIp(new Headers())).toBe("unknown");
    });

    it("gebruikt next/headers zonder meegegeven Headers", async () => {
      nextHeaders({ "x-real-ip": "5.6.7.8" });
      expect(await clientIp()).toBe("5.6.7.8");
      expect(headers).toHaveBeenCalledTimes(1);
    });
  });

  describe("rateLimitIp", () => {
    it("bouwt de sleutel als <scope>:ip:<ip>", async () => {
      db.$queryRaw.mockResolvedValue([{ count: 1, resetAt: new Date() }]);
      nextHeaders({ "x-real-ip": "1.2.3.4" });
      expect(await rateLimitIp("checkout", 15, 600_000)).toEqual({ ok: true, retryAfter: 0 });
      const values = db.$queryRaw.mock.calls[0].slice(1) as unknown[];
      expect(values[0]).toBe("checkout:ip:1.2.3.4");
    });

    it("deelt één strengere bucket (limiet / 5) zonder herleidbaar IP", async () => {
      db.$queryRaw.mockResolvedValue([{ count: 4, resetAt: new Date(Date.now() + 10_000) }]);
      nextHeaders({});
      // limiet 15 → 3 voor "unknown": count 4 is te veel
      expect((await rateLimitIp("checkout", 15, 600_000)).ok).toBe(false);
      const values = db.$queryRaw.mock.calls[0].slice(1) as unknown[];
      expect(values[0]).toBe("checkout:ip:unknown");
    });

    it("geeft failClosed en expliciete headers door", async () => {
      db.$queryRaw.mockRejectedValue(new Error("down"));
      const result = await rateLimitIp("login", 5, 60_000, { failClosed: true, headers: new Headers({ "x-real-ip": "1.1.1.1" }) });
      expect(result).toEqual({ ok: false, retryAfter: 60 });
      expect(headers).not.toHaveBeenCalled();
    });
  });
});
