import { checkServerEnv, validateServerEnv } from "@/lib/env";

const FULL = {
  DATABASE_URL: "postgresql://user:pw@host/db",
  AUTH_SECRET: "x".repeat(40),
  MOLLIE_API_KEY: "test_abc",
  SMTP_HOST: "smtp.example.nl",
  SMTP_USER: "u",
  SMTP_PASS: "p",
  CLOUDINARY_API_KEY: "k",
  CLOUDINARY_API_SECRET: "s",
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "c",
  CRON_SECRET: "c",
  NEXT_PUBLIC_BASE_URL: "https://example.nl",
};

describe("lib/env", () => {
  it("is in orde met alle variabelen", () => {
    const r = validateServerEnv(FULL);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("accepteert NEXTAUTH_SECRET als alternatief voor AUTH_SECRET", () => {
    const r = validateServerEnv({ ...FULL, AUTH_SECRET: undefined, NEXTAUTH_SECRET: "y".repeat(40) });
    expect(r.ok).toBe(true);
  });

  it("meldt ontbrekende verplichte variabelen als fout", () => {
    const r = validateServerEnv({ ...FULL, DATABASE_URL: undefined, AUTH_SECRET: "" });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(["DATABASE_URL ontbreekt", "AUTH_SECRET (of NEXTAUTH_SECRET) ontbreekt"]);
  });

  it("meldt optionele variabelen en een korte secret alleen als waarschuwing", () => {
    const r = validateServerEnv({ DATABASE_URL: FULL.DATABASE_URL, AUTH_SECRET: "kort" });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("AUTH_SECRET is korter"))).toBe(true);
    expect(r.warnings.some((w) => w.startsWith("MOLLIE_API_KEY ontbreekt"))).toBe(true);
  });

  it("gooit nooit in tests (NODE_ENV=test), ook niet zonder DATABASE_URL", () => {
    expect(() => checkServerEnv()).not.toThrow();
  });
});
