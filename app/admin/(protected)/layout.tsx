import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const metadata = {
  title: "Admin · Mokka Home Interior",
  robots: { index: false, follow: false },
};

/** Tijdstip n dagen geleden (buiten de component: geen impure call in render). */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  // Badge: contactberichten van de laatste 7 dagen.
  const since = daysAgo(7);
  const recentMessages = await prisma.contactMessage.count({ where: { createdAt: { gte: since } } });

  return (
    // dvh i.p.v. vh: op iOS verandert de viewport-hoogte met de adresbalk.
    <div className="min-h-dvh bg-bone">
      <AdminSidebar
        userName={session.user.name ?? "Admin"}
        userEmail={session.user.email ?? ""}
        messagesBadge={recentMessages}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/admin/login" });
        }}
      />
      {/* Zijkanten/onderkant respecteren de safe-area (notch, home-balk); de
          topbalk en sidebar regelen hun eigen inset in AdminSidebar. */}
      <main className="lg:ml-64 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-6 sm:py-8 lg:py-14">{children}</div>
      </main>
    </div>
  );
}
