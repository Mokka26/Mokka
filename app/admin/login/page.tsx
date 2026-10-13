import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/safePath";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Login · Mokka Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; reason?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(safeInternalPath(params.from));

  // Na een wachtwoordwijziging wordt de sessie beëindigd (settings/actions.ts)
  // en komt de beheerder hier met ?reason=password-changed.
  const notice = params.reason === "password-changed" ? "Je wachtwoord is gewijzigd. Log opnieuw in." : undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-bone px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="font-serif text-3xl text-ink tracking-tight">Mokka</p>
          <p className="eyebrow-lg mt-1">Admin</p>
        </div>
        <LoginForm from={params.from} notice={notice} />
      </div>
    </div>
  );
}
