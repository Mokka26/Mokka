"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { updateProfile, type ProfileState } from "./actions";

const initial: ProfileState = {};

export default function ProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  // Afgeleid van de action-state: geen effect, geen `Date.now()` in render.
  const saved = Boolean(state.ok) && !pending;

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="profile-email" className="block eyebrow-lg mb-2">
          E-mail
        </label>
        <input
          id="profile-email"
          value={email}
          disabled
          className="w-full min-h-11 px-3 py-2.5 bg-bone border border-line-strong text-stone text-base cursor-not-allowed"
        />
        <p className="text-sm text-stone mt-1.5">E-mail kan niet worden gewijzigd.</p>
      </div>

      <div>
        <label htmlFor="profile-name" className="block eyebrow-lg mb-2">
          Naam
        </label>
        <input
          id="profile-name"
          name="name"
          defaultValue={initialName}
          required
          minLength={2}
          maxLength={100}
          className="w-full min-h-11 px-3 py-2.5 bg-white border border-line-strong text-ink text-base focus:outline-none focus:border-accent"
        />
        {state.fieldErrors?.name && (
          <p className="text-sm text-error mt-1.5">{state.fieldErrors.name}</p>
        )}
      </div>

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
          {pending ? "Opslaan…" : "Profiel opslaan"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-accent">
            <Check className="w-3.5 h-3.5" />
            Opgeslagen
          </span>
        )}
      </div>
    </form>
  );
}
