"use client";

import { useEffect } from "react";
import Link from "next/link";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { captureError } from "@/lib/sentry-client";

// Foutpagina voor /checkout/**: stelt gerust over de betaling (elke betaling
// wordt via Mollie-webhook + reconcile gecontroleerd; een geslaagde betaling
// krijgt altijd een bevestiging) en biedt een directe lijn naar de winkel.
export default function CheckoutError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureError(error, { scope: "checkout/error", digest: error.digest });
  }, [error]);

  const phoneLink = getPhoneLink();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
      <div className="bg-white border border-line p-12 sm:p-20 text-center max-w-2xl w-full">
        <p className="eyebrow mb-6">Afrekenen</p>
        <h1 className="display-md text-ink mb-6">Er ging iets mis bij het afrekenen</h1>
        <p className="body-lg text-slate mb-4">
          Je winkelwagen staat nog klaar. Probeer het opnieuw of kies een andere betaalmethode.
        </p>
        <p className="text-slate mb-10">
          Heb je al betaald? Dan ontvang je altijd een bevestiging per e-mail — we controleren elke betaling. Twijfel je? Bel ons even.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button type="button" onClick={reset} className="btn-primary">
            Probeer opnieuw
          </button>
          <Link href="/checkout" className="btn-link">Terug naar afrekenen</Link>
        </div>
        {phoneLink && businessInfo.contact.phoneFormatted && (
          <p className="text-stone text-sm mt-10">
            Bel ons op{" "}
            <a href={phoneLink} className="text-ink underline underline-offset-4">
              {businessInfo.contact.phoneFormatted}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
