"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { changePassword, type PasswordState } from "./actions";

const initial: PasswordState = {};

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setSavedAt(Date.now());
      formRef.current?.reset();
    }
  }, [state.ok]);

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
        <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-ink text-white px-6 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-bronze transition-colors disabled:opacity-60"
        >
          {pending ? "Wijzigen…" : "Wachtwoord wijzigen"}
        </button>
        {savedAt && !pending && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-bronze">
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
        className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-2"
      >
        {label}
      </label>
      <input
        id={`pw-${name}`}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        className="w-full px-3 py-2.5 bg-white border border-line text-ink text-sm focus:outline-none focus:border-bronze"
      />
      {error && <p className="text-[11px] text-red-700 mt-1.5">{error}</p>}
    </div>
  );
}
