import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./ProfileForm";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const user = userId
    ? await prisma.adminUser.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true },
      })
    : null;

  return (
    <div className="max-w-2xl">
      <header className="mb-10">
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-2">Beheer</p>
        <h1 className="font-serif text-4xl text-ink leading-none">Instellingen</h1>
      </header>

      <section className="bg-white border border-line p-6 lg:p-8 mb-6">
        <header className="mb-5">
          <h2 className="font-serif text-xl text-ink leading-none mb-1">Profiel</h2>
          <p className="text-[12px] text-stone">Naam zoals zichtbaar in het admin paneel.</p>
        </header>
        <ProfileForm initialName={user?.name ?? ""} email={user?.email ?? ""} />
      </section>

      <section className="bg-white border border-line p-6 lg:p-8">
        <header className="mb-5">
          <h2 className="font-serif text-xl text-ink leading-none mb-1">Wachtwoord wijzigen</h2>
          <p className="text-[12px] text-stone">
            Minimaal 8 tekens. Gebruik een sterk wachtwoord, vooral voor productie.
          </p>
        </header>
        <PasswordForm />
      </section>
    </div>
  );
}
