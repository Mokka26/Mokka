import { safeInternalPath } from "@/lib/safePath";
import { isCronAuthorized } from "@/lib/cron-auth";

describe("lib/safePath · safeInternalPath", () => {
  it("accepteert alleen interne paden", () => {
    expect(safeInternalPath("/admin/orders?x=1")).toBe("/admin/orders?x=1");
    expect(safeInternalPath("/")).toBe("/");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "admin", "", null, undefined, 42])(
    "valt terug op de fallback bij %p",
    (from) => {
      expect(safeInternalPath(from)).toBe("/admin");
      expect(safeInternalPath(from, "/x")).toBe("/x");
    },
  );
});

describe("lib/cron-auth · isCronAuthorized", () => {
  const ORIGINAL = process.env.CRON_SECRET;
  const req = (authorization?: string, extra: Record<string, string> = {}) =>
    new Request("http://localhost/api/cron/x", { headers: { ...(authorization ? { authorization } : {}), ...extra } });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL;
  });

  it("weigert alles zonder geconfigureerde secret", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(req("Bearer x"))).toBe(false);
  });

  it("accepteert alleen exact Bearer <CRON_SECRET>", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(isCronAuthorized(req("Bearer s3cret-value"))).toBe(true);
    expect(isCronAuthorized(req("Bearer s3cret-valu"))).toBe(false);
    expect(isCronAuthorized(req("Bearer s3cret-value2"))).toBe(false);
    expect(isCronAuthorized(req("Basic s3cret-value"))).toBe(false);
    expect(isCronAuthorized(req("s3cret-value"))).toBe(false);
    expect(isCronAuthorized(req())).toBe(false);
  });

  it("vertrouwt de x-vercel-cron-header niet", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(isCronAuthorized(req(undefined, { "x-vercel-cron": "1" }))).toBe(false);
  });
});
