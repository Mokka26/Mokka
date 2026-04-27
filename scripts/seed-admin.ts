/**
 * Seed eerste admin user in de database.
 *
 * Gebruik:
 *   npx tsx scripts/seed-admin.ts
 *
 * Vereist in .env.local: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    console.error("ADMIN_EMAIL en ADMIN_PASSWORD ontbreken in .env.local");
    process.exit(1);
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin '${email}' bestaat al. Niets gewijzigd.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.adminUser.create({
    data: { email, name, passwordHash },
  });

  console.log(`Admin aangemaakt:`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Naam:  ${user.name}`);
  console.log(`  Login op: /admin/login`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
