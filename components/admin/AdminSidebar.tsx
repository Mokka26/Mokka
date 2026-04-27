"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Producten", icon: Package },
  { href: "/admin/orders", label: "Bestellingen", icon: ShoppingBag, disabled: true },
  { href: "/admin/settings", label: "Instellingen", icon: Settings },
];

type Props = {
  userName: string;
  userEmail: string;
  signOutAction: () => Promise<void>;
};

export default function AdminSidebar(props: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-ink text-white border-b border-white/10 flex items-center justify-between px-5 py-4">
        <Link href="/admin" className="block">
          <p className="font-serif text-xl tracking-tight leading-none">Mokka</p>
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/50 mt-0.5">Admin</p>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 -mr-2 hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-ink text-white flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-7 pt-9 pb-7 border-b border-white/10 flex items-center justify-between">
          <Link href="/admin" className="block">
            <p className="font-serif text-2xl tracking-tight">Mokka</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mt-0.5">Admin</p>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 -mr-2 hover:bg-white/10"
            aria-label="Sluit menu"
          >
            <X className="w-5 h-5" />
          </button>
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
            <p className="text-[13px] text-white">{props.userName}</p>
            <p className="text-[11px] text-white/50 truncate">{props.userEmail}</p>
          </div>
          <form action={props.signOutAction}>
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
    </>
  );
}
