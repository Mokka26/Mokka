"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CheckoutMethod } from "@/lib/mollie";
import { MolliePaymentChips, PaymentIconRow } from "@/components/PaymentIcons";

/**
 * Live Mollie-betaalmethoden (dezelfde gecachte lijst als de footer, zie
 * lib/mollie getFooterMethods) beschikbaar in client components: winkelwagen,
 * CartDrawer en checkout. De root layout zet de provider; zonder provider of
 * zonder Mollie-key is de lijst leeg en vallen de chips terug op de vaste iconen.
 */
const PaymentMethodsContext = createContext<ReadonlyArray<CheckoutMethod>>([]);

export function PaymentMethodsProvider({ methods, children }: { methods: ReadonlyArray<CheckoutMethod>; children: ReactNode }) {
  return <PaymentMethodsContext.Provider value={methods}>{children}</PaymentMethodsContext.Provider>;
}

export function usePaymentMethods(): ReadonlyArray<CheckoutMethod> {
  return useContext(PaymentMethodsContext);
}

/**
 * Betaalchips zoals in de footer (kleuricoon op witte chip). `methods` overschrijft
 * de lijst uit de context, bv. op de checkout waar Mollie per bedrag filtert.
 */
export function PaymentMethodChips({
  methods,
  className = "",
}: {
  methods?: ReadonlyArray<CheckoutMethod>;
  className?: string;
}) {
  const fromContext = usePaymentMethods();
  const list = methods && methods.length > 0 ? methods : fromContext;
  if (list.length === 0) return <PaymentIconRow className={className} />;
  return <MolliePaymentChips methods={list} tone="dark" className={className} />;
}
