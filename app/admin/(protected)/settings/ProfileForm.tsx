"use client";

import { useActionState, useEffect, useState } from "react";
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
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (state.ok) setSavedAt(Date.now());
  }, [state.ok]);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-2">
          E-mail
        </label>
        <input
          value={email}
          disabled
          className="w-full px-3 py-2.5 bg-bone border border-line text-stone text-sm cursor-not-allowed"
        />
        <p className="text-[11px] text-stone/70 mt-1.5">E-mail kan niet worden gewijzigd.</p>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-2">
          Naam
        </label>
        <input
          name="name"
          defaultValue={initialName}
          required
          minLength={2}
          maxLength={100}
          className="w-full px-3 py-2.5 bg-white border border-line text-ink text-sm focus:outline-none focus:border-bronze"
        />
        {state.fieldErrors?.name && (
          <p className="text-[11px] text-red-700 mt-1.5">{state.fieldErrors.name}</p>
        )}
      </div>

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
          {pending ? "Opslaan…" : "Profiel opslaan"}
        </button>
        {savedAt && !pending && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-bronze">
            <Check className="w-3.5 h-3.5" />
            Opgeslagen
          </span>
        )}
      </div>
    </form>
  );
}
