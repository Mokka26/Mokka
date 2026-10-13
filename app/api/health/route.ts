import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";
import { captureError } from "@/lib/sentry";

// Health-check.
//   Anoniem:  { ok } — alleen een snelle DB-ping (3 s timeout), geen aantallen,
//             drempels of externe probes (die lekten interne info en kostten
//             ~5 s per aanroep voor iedereen die de URL kende).
//   Met `Authorization: Bearer <CRON_SECRET>`: volledige diagnose met
//             latencies, productaantal en Cloudinary-bereikbaarheid.

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

// Geen hardcoded cloud-naam als fallback: zonder env-var is Cloudinary niet
// geconfigureerd en meldt de check dat (i.p.v. stil een andere account te pingen).
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PROBE = CLOUD_NAME
  ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_10,q_auto/v1/mokka/health-probe.jpg`
  : null;

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; value?: T }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t0, value };
  } catch (err) {
    captureError(err, { scope: "health" });
    return { ok: false, ms: Date.now() - t0 };
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

type CloudinaryProbe = { configured: boolean; status?: number; reachable: boolean };

async function probeCloudinary(): Promise<CloudinaryProbe> {
  if (!CLOUDINARY_PROBE) return { configured: false, reachable: false };
  const r = await fetch(CLOUDINARY_PROBE, { method: "HEAD", signal: AbortSignal.timeout(5000) });
  // 404 is OK — betekent Cloudinary bereikbaar, alleen probe niet bestaand
  return { configured: true, status: r.status, reachable: r.status < 500 };
}

export async function GET(req: NextRequest) {
  const db = await timed(() => withTimeout(prisma.$queryRaw`SELECT 1`, 3000));

  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: db.ok }, { status: db.ok ? 200 : 503, headers: NO_STORE });
  }

  const [productCount, cloudinary] = await Promise.all([
    timed(() => prisma.product.count({ where: { hidden: false, deletedAt: null } })),
    timed(probeCloudinary),
  ]);

  const cloudinaryOk = cloudinary.ok && cloudinary.value?.reachable === true;
  const allOk = db.ok && productCount.ok && cloudinaryOk;

  return NextResponse.json(
    {
      ok: allOk,
      ts: new Date().toISOString(),
      checks: {
        db: { ok: db.ok, ms: db.ms },
        products: { ok: productCount.ok, ms: productCount.ms, count: productCount.value },
        cloudinary: {
          ok: cloudinaryOk,
          configured: cloudinary.value?.configured ?? Boolean(CLOUD_NAME),
          ms: cloudinary.ms,
          status: cloudinary.value?.status,
        },
      },
      thresholds: {
        warning: "DB > 500ms = mogelijk Neon cold-start of pooler-issue",
        critical: "DB > 3000ms = pooler ontbreekt of Neon onbereikbaar",
      },
    },
    { status: allOk ? 200 : 503, headers: NO_STORE },
  );
}
