import { PrismaClient, Prisma } from "@prisma/client";

// Serverless Postgres (Neon) laat af en toe een connectie vallen: P1001
// ("can't reach database server"), P1017 ("server closed the connection"),
// timeouts. Eén zo'n hik brak eerder de build af en zou nu een on-demand
// productpagina laten falen. Deze extensie probeert een mislukte query opnieuw
// met backoff — ALLEEN voor lees-operaties, zodat writes op de geldstroom
// (order aanmaken, voorraad afboeken) nooit dubbel kunnen uitvoeren.

const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const READ_OPS = new Set([
  "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow",
  "findMany", "count", "aggregate", "groupBy",
]);

function isRetryable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true; // kon niet verbinden
  if (e instanceof Prisma.PrismaClientKnownRequestError) return RETRYABLE_CODES.has(e.code);
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeClient() {
  return new PrismaClient().$extends({
    name: "retry-reads",
    query: {
      async $allOperations({ operation, args, query }) {
        if (!READ_OPS.has(operation)) return query(args);
        let lastErr: unknown;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            return await query(args);
          } catch (e) {
            lastErr = e;
            if (!isRetryable(e)) throw e;
            await sleep(200 * 2 ** attempt); // 200, 400, 800ms
          }
        }
        throw lastErr;
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
