// Draait een prisma-commando met .env.local geladen (prisma CLI leest zelf alleen .env).
// Argument "ENV:NAME" wordt vervangen door process.env.NAME zonder het te tonen.
require("dotenv").config({ path: ".env.local" });
const { spawnSync } = require("child_process");
const args = process.argv.slice(2).map((a) => (a.startsWith("ENV:") ? `"${process.env[a.slice(4)] ?? ""}"` : a));
const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", ...args], { stdio: "inherit", shell: true, env: process.env });
process.exit(r.status ?? 1);
