"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export default function LoginForm({ from }: { from?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-5 bg-white p-8 border border-line">
      {from && <input type="hidden" name="from" value={from} />}

      <div>
        <label htmlFor="email" className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-2">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-bronze transition-colors disabled:opacity-60"
        />
        {state.fieldErrors?.email && (
          <p className="text-[11px] text-red-700 mt-1.5">{state.fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-2">
          Wachtwoord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-bronze transition-colors disabled:opacity-60"
        />
        {state.fieldErrors?.password && (
          <p className="text-[11px] text-red-700 mt-1.5">{state.fieldErrors.password}</p>
        )}
      </div>

      {state.error && (
        <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ink text-white px-6 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-bronze transition-colors disabled:opacity-60"
      >
        {pending ? "Inloggen…" : "Inloggen"}
      </button>
    </form>
  );
}
