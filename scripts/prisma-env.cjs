// Draait een prisma-commando met .env.local geladen (prisma CLI leest zelf alleen .env).
// Argument "ENV:NAME" wordt vervangen door process.env.NAME zonder het te tonen.
require("dotenv").config({ path: ".env.local" });
const { spawnSync } = require("child_process");
const env = { ...process.env };
// Migraties nooit via de Neon-pooler (pgbouncer): advisory locks blijven daar
// aan gepoolde serververbindingen hangen en de volgende `migrate deploy`
// loopt vast op een lock-timeout (P1002). De directe host is dezelfde URL
// zonder "-pooler". DIRECT_DATABASE_URL (indien gezet) gaat vóór.
if (process.argv[2] === "migrate" && env.DATABASE_URL) {
  env.DATABASE_URL = env.DIRECT_DATABASE_URL || env.DATABASE_URL.replace("-pooler.", ".");
}
// `--only-production` (gebruikt door `npm run build`): migreer alleen bij een
// Vercel-productiebuild of met MIGRATE_ON_BUILD=1. Preview-builds en lokale
// builds raken zo nooit (per ongeluk) de productiedatabase. Handmatig migreren
// blijft `npm run db:migrate`.
const ONLY_PROD = "--only-production";
if (process.argv.includes(ONLY_PROD)) {
  const allowed = process.env.VERCEL_ENV === "production" || process.env.MIGRATE_ON_BUILD === "1";
  if (!allowed) {
    console.log(`[prisma-env] migratie overgeslagen (VERCEL_ENV=${process.env.VERCEL_ENV ?? "lokaal"})`);
    process.exit(0);
  }
}
const args = process.argv.slice(2).filter((a) => a !== ONLY_PROD).map((a) => (a.startsWith("ENV:") ? `"${env[a.slice(4)] ?? ""}"` : a));
const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", ...args], { stdio: "inherit", shell: true, env });
process.exit(r.status ?? 1);
