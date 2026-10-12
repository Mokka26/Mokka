"use client";

import { useEffect } from "react";
import Link from "next/link";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { captureError } from "@/lib/sentry";

// Route-niveau foutpagina (binnen de root layout, dus navbar/footer blijven).
// Geen technische details naar de bezoeker; die staan in Sentry.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureError(error, { scope: "app/error", digest: error.digest });
  }, [error]);

  const phoneLink = getPhoneLink();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
      <div className="bg-white border border-line p-12 sm:p-20 text-center max-w-2xl w-full">
        <p className="eyebrow mb-6">Foutmelding</p>
        <h1 className="display-md text-ink mb-6">Er ging iets mis</h1>
        <p className="body-lg text-slate mb-10">
          Dit lag niet aan jou. Probeer het opnieuw — blijft het misgaan, dan helpen we je graag persoonlijk.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button type="button" onClick={reset} className="btn-primary">
            Probeer opnieuw
          </button>
          <Link href="/" className="btn-link">Naar home</Link>
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
