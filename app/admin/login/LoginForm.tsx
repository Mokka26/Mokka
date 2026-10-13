"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export default function LoginForm({ from, notice }: { from?: string; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-5 bg-white p-8 border border-line">
      {from && <input type="hidden" name="from" value={from} />}

      {notice && (
        <p role="status" className="text-base text-ink bg-success/10 border border-success/30 px-3 py-2 leading-relaxed">
          {notice}
        </p>
      )}

      <div>
        <label htmlFor="email" className="block eyebrow-lg mb-2">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className="w-full min-h-11 px-3 py-2.5 bg-bone border border-line-strong text-ink text-base focus:outline-none focus:border-accent transition-colors disabled:opacity-60"
        />
        {state.fieldErrors?.email && (
          <p className="text-sm text-error mt-1.5">{state.fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block eyebrow-lg mb-2">
          Wachtwoord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className="w-full min-h-11 px-3 py-2.5 bg-bone border border-line-strong text-ink text-base focus:outline-none focus:border-accent transition-colors disabled:opacity-60"
        />
        {state.fieldErrors?.password && (
          <p className="text-sm text-error mt-1.5">{state.fieldErrors.password}</p>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-error bg-error/10 border border-error/30 px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full bg-ink text-white px-6 py-3 text-sm uppercase tracking-[0.1em] hover:bg-accent transition-colors disabled:opacity-60"
      >
        {pending ? "Inloggen…" : "Inloggen"}
      </button>
    </form>
  );
}
