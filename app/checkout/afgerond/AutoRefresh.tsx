"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Ververst de bedankpagina zolang de betaling nog "open" is (Mollie bevestigt
 * soms pas na enkele seconden). Stopt na ~1 minuut; daarna neemt de webhook
 * het over en krijgt de klant de bevestiging per mail.
 */
export function AutoRefresh({ intervalMs = 5000, maxTries = 12 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (tries > maxTries) {
        window.clearInterval(id);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs, maxTries]);
  return null;
}
