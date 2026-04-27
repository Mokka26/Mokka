import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const metadata = {
  title: "Admin · Mokka Home Interior",
  robots: { index: false, follow: false },
};

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-bone">
      <AdminSidebar
        userName={session.user.name ?? "Admin"}
        userEmail={session.user.email ?? ""}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/admin/login" });
        }}
      />
      <main className="lg:ml-64">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10 lg:py-14">
          {children}
        </div>
      </main>
    </div>
  );
}
