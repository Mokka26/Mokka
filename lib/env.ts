import { z } from "zod";

/**
 * Controle van de server-omgevingsvariabelen, één keer bij het opstarten van
 * de Node-server (instrumentation.ts → checkServerEnv) en lui bij het eerste
 * gebruik van serverEnv().
 *
 * - Verplicht (zonder werkt de winkel niet): DATABASE_URL en AUTH_SECRET (of
 *   de v4-naam NEXTAUTH_SECRET, zie auth.ts). Ontbreken die in productie, dan
 *   stopt de server met een duidelijke melding in plaats van later met een
 *   vage Prisma- of NextAuth-fout.
 * - Optioneel (één functie valt weg): Mollie, SMTP, Cloudinary-upload,
 *   CRON_SECRET, GA4 Measurement Protocol. Alleen een waarschuwing in de log.
 * - Tijdens `next build` en in tests wordt nooit gestopt: daar ontbreken
 *   runtime-geheimen vaak bewust.
 *
 * Nieuwe env-var? Voeg hem hier toe én in .env.example.
 */

const nonEmpty = z.string().trim().min(1);

// Alleen aanwezigheid is hard verplicht; vorm en lengte geven een waarschuwing
// (een iets kortere secret of een prisma://-URL mag de winkel niet platleggen).
const requiredSchema = z.object({
  DATABASE_URL: nonEmpty,
  AUTH_SECRET: nonEmpty,
});

function shapeWarnings(env: ServerEnv): string[] {
  const out: string[] = [];
  if (!/^(postgres(ql)?|prisma(\+postgres)?):\/\//.test(env.DATABASE_URL)) {
    out.push("DATABASE_URL lijkt geen postgres://-URL");
  }
  if (env.AUTH_SECRET.length < 32) out.push("AUTH_SECRET is korter dan 32 tekens (genereer een nieuwe met `npx auth secret`)");
  return out;
}

/** Per optionele variabele: wat er niet werkt als hij ontbreekt. */
const OPTIONAL: ReadonlyArray<{ keys: ReadonlyArray<string>; impact: string }> = [
  { keys: ["MOLLIE_API_KEY"], impact: "afrekenen en betaalmethoden (Mollie)" },
  { keys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"], impact: "e-mail (orderbevestiging, contactformulier)" },
  { keys: ["CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"], impact: "foto-upload en -opschoning in de admin" },
  { keys: ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"], impact: "productfoto-URL's" },
  { keys: ["CRON_SECRET"], impact: "cronjobs (alle cron-aanroepen worden geweigerd)" },
  { keys: ["NEXT_PUBLIC_BASE_URL"], impact: "site-URL (valt terug op het standaarddomein)" },
];

export type ServerEnv = z.infer<typeof requiredSchema>;

export type EnvCheck = {
  ok: boolean;
  env: ServerEnv | null;
  /** Ontbrekende of ongeldige verplichte variabelen, met reden. */
  errors: string[];
  /** Ontbrekende optionele variabelen, met wat er dan niet werkt. */
  warnings: string[];
};

/** Pure controle (testbaar): leest alleen de meegegeven omgeving. */
export function validateServerEnv(source: Readonly<Record<string, string | undefined>>): EnvCheck {
  const parsed = requiredSchema.safeParse({
    DATABASE_URL: source.DATABASE_URL,
    AUTH_SECRET: source.AUTH_SECRET || source.NEXTAUTH_SECRET,
  });
  const errors = parsed.success
    ? []
    : parsed.error.issues.map((i) => {
        const key = String(i.path[0] ?? "?");
        const name = key === "AUTH_SECRET" ? "AUTH_SECRET (of NEXTAUTH_SECRET)" : key;
        // Alleen aanwezigheid wordt gecontroleerd: undefined (invalid_type) of leeg (too_small).
        return `${name} ontbreekt`;
      });
  const warnings = [
    ...(parsed.success ? shapeWarnings(parsed.data) : []),
    ...OPTIONAL.filter(({ keys }) => keys.some((k) => !source[k]?.trim())).map(
      ({ keys, impact }) => `${keys.filter((k) => !source[k]?.trim()).join(", ")} ontbreekt — werkt niet: ${impact}`,
    ),
  ];
  return { ok: parsed.success, env: parsed.success ? parsed.data : null, errors, warnings };
}

function isBuildOrTest(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "test";
}

let checked: EnvCheck | null = null;

/**
 * Controleert process.env één keer en logt het resultaat. Gooit alleen in
 * productie-runtime bij ontbrekende verplichte variabelen; nooit tijdens de
 * build of in tests.
 */
export function checkServerEnv(): EnvCheck {
  if (checked) return checked;
  const result = validateServerEnv(process.env);
  checked = result;
  if (isBuildOrTest()) return result;

  for (const w of result.warnings) console.warn(`[env] ${w}`);
  if (result.ok) return result;

  const message = `[env] Verplichte omgevingsvariabelen ontbreken of zijn ongeldig: ${result.errors.join("; ")}`;
  console.error(message);
  if (process.env.NODE_ENV === "production") throw new Error(message);
  return result;
}

/** Gevalideerde verplichte server-env (controle bij het eerste gebruik). */
export function serverEnv(): ServerEnv {
  const result = checkServerEnv();
  if (!result.env) throw new Error(`Server-omgeving ongeldig: ${result.errors.join("; ")}`);
  return result.env;
}
