"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { z } from "zod";
import { safeInternalPath } from "@/lib/safePath";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord vereist"),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "email" | "password";
      fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  // Bruteforce-bescherming: max 5 pogingen per 10 min per IP + per e-mailadres.
  const ip = await clientIp();
  const emailKey = parsed.data.email.toLowerCase();
  for (const key of [`login:ip:${ip}`, `login:email:${emailKey}`]) {
    const rl = await rateLimit(key, 5, 10 * 60 * 1000);
    if (!rl.ok) {
      return { error: `Te veel inlogpogingen. Probeer het over ${Math.ceil(rl.retryAfter / 60)} minuten opnieuw.` };
    }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeInternalPath(formData.get("from")),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Onjuiste inloggegevens" };
    }
    throw err;
  }
  return {};
}
