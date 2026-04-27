import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Login · Mokka Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(params.from || "/admin");

  return (
    <div className="min-h-screen flex items-center justify-center bg-bone px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="font-serif text-3xl text-ink tracking-tight">Mokka</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone mt-1">Admin</p>
        </div>
        <LoginForm from={params.from} />
      </div>
    </div>
  );
}
