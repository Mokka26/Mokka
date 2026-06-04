import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Volledige diagnose: DB-latency + Cloudinary-bereikbaarheid + meta.
// Bezoek /api/health in browser om snel te zien waar het hapert.

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CLOUDINARY_PROBE =
  "https://res.cloudinary.com/diaksxzey/image/upload/w_10,q_auto/v1/mokka/health-probe.jpg";

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; value?: T; error?: string }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t0, value };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const [db, productCount, cloudinary] = await Promise.all([
    timed(() => prisma.$queryRaw`SELECT 1`),
    timed(() => prisma.product.count({ where: { hidden: false, deletedAt: null } })),
    timed(async () => {
      const r = await fetch(CLOUDINARY_PROBE, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      // 404 is OK — betekent Cloudinary bereikbaar, alleen probe niet bestaand
      return { status: r.status, reachable: r.status < 500 };
    }),
  ]);

  const allOk = db.ok && productCount.ok && cloudinary.ok && cloudinary.value?.reachable === true;

  return NextResponse.json(
    {
      ok: allOk,
      ts: new Date().toISOString(),
      // Geen rauwe foutmeldingen in de publieke respons (lekken DB/driver-
      // interne info aan anonieme bezoekers). Details staan in Sentry/logs.
      checks: {
        db: { ok: db.ok, ms: db.ms },
        products: { ok: productCount.ok, ms: productCount.ms, count: productCount.value },
        cloudinary: {
          ok: cloudinary.ok && cloudinary.value?.reachable === true,
          ms: cloudinary.ms,
          status: cloudinary.value?.status,
        },
      },
      thresholds: {
        warning: "DB > 500ms = mogelijk Neon cold-start of pooler-issue",
        critical: "DB > 3000ms = pooler ontbreekt of Neon onbereikbaar",
      },
    },
    { status: allOk ? 200 : 503 },
  );
}
