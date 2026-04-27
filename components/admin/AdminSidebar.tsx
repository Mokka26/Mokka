"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingBag, Settings, LogOut } from "lucide-react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Producten", icon: Package },
  { href: "/admin/orders", label: "Bestellingen", icon: ShoppingBag, disabled: true },
  { href: "/admin/settings", label: "Instellingen", icon: Settings, disabled: true },
];

export default function AdminSidebar({
  userName,
  userEmail,
  signOutAction,
}: {
  userName: string;
  userEmail: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 bg-ink text-white">
      <div className="px-7 pt-9 pb-7 border-b border-white/10">
        <Link href="/admin" className="block">
          <p className="font-serif text-2xl tracking-tight">Mokka</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mt-0.5">Admin</p>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-6">
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            const Icon = item.icon;
            if (item.disabled) {
              return (
                <li key={item.href}>
                  <span className="flex items-center gap-3 px-4 py-2.5 text-[13px] tracking-wide text-white/30 cursor-not-allowed">
                    <Icon className="w-4 h-4" />
                    {item.label}
                    <span className="ml-auto text-[9px] uppercase tracking-[0.2em] text-white/30">
                      soon
                    </span>
                  </span>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 text-[13px] tracking-wide transition-colors ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-3 pb-5 pt-4 border-t border-white/10">
        <div className="px-4 py-3">
          <p className="text-[13px] text-white">{userName}</p>
          <p className="text-[11px] text-white/50 truncate">{userEmail}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] tracking-wide text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Uitloggen
          </button>
        </form>
      </div>
    </aside>
  );
}
