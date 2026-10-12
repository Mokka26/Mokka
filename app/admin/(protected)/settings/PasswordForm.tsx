"use client";

import { useActionState, useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { changePassword, type PasswordState } from "./actions";

const initial: PasswordState = {};

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  const formRef = useRef<HTMLFormElement>(null);
  // Afgeleid van de action-state: geen setState in een effect.
  const saved = Boolean(state.ok) && !pending;

  // Formulier leegmaken na succes is een DOM-bijwerking (extern systeem) en
  // hoort dus wél in een effect.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <PasswordField
        name="current"
        label="Huidig wachtwoord"
        autoComplete="current-password"
        error={state.fieldErrors?.current}
      />
      <PasswordField
        name="next"
        label="Nieuw wachtwoord"
        autoComplete="new-password"
        error={state.fieldErrors?.next}
      />
      <PasswordField
        name="confirm"
        label="Bevestig nieuw wachtwoord"
        autoComplete="new-password"
        error={state.fieldErrors?.confirm}
      />

      {state.error && (
        <p className="text-sm text-error bg-error/10 border border-error/30 px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 bg-ink text-white px-6 py-3 text-sm uppercase tracking-[0.1em] hover:bg-accent transition-colors disabled:opacity-60"
        >
          {pending ? "Wijzigen…" : "Wachtwoord wijzigen"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-accent">
            <Check className="w-3.5 h-3.5" />
            Wachtwoord gewijzigd
          </span>
        )}
      </div>
    </form>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  error,
}: {
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`pw-${name}`}
        className="block eyebrow-lg mb-2"
      >
        {label}
      </label>
      <input
        id={`pw-${name}`}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        className="w-full min-h-11 px-3 py-2.5 bg-white border border-line-strong text-ink text-base focus:outline-none focus:border-accent"
      />
      {error && <p className="text-sm text-error mt-1.5">{error}</p>}
    </div>
  );
}
