"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Trash2,
} from "lucide-react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Producten", icon: Package },
  { href: "/admin/orders", label: "Bestellingen", icon: ShoppingBag },
  { href: "/admin/messages", label: "Berichten", icon: MessageSquare, badge: "messages" as const },
  { href: "/admin/trash", label: "Prullenbak", icon: Trash2 },
  { href: "/admin/settings", label: "Instellingen", icon: Settings },
];

type Props = {
  userName: string;
  userEmail: string;
  /** Aantal contactberichten van de laatste 7 dagen. */
  messagesBadge?: number;
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
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [mobileOpen]);

  const badges: Record<string, number | undefined> = { messages: props.messagesBadge };

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-ink text-white border-b border-white/10 flex items-center justify-between px-4 py-2">
        <Link href="/admin" className="block min-h-11 flex flex-col justify-center">
          <p className="font-serif text-xl tracking-tight leading-none">Mokka</p>
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/60 mt-0.5">Admin</p>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center justify-center w-11 h-11 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
          aria-label="Menu openen"
          aria-expanded={mobileOpen}
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        aria-label="Admin-navigatie"
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-ink text-white flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-7 pt-9 pb-7 border-b border-white/10 flex items-center justify-between">
          <Link href="/admin" className="block">
            <p className="font-serif text-2xl tracking-tight">Mokka</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/60 mt-0.5">Admin</p>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Menu sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6">
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
              const Icon = item.icon;
              const badge = item.badge ? badges[item.badge] : undefined;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 min-h-11 px-4 py-2.5 text-[13px] tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {item.label}
                    {badge != null && badge > 0 && (
                      <span
                        className="ml-auto inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-accent text-white text-[11px] tabular-nums"
                        aria-label={`${badge} ${badge === 1 ? "nieuw bericht" : "nieuwe berichten"} in de laatste 7 dagen`}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 pb-5 pt-4 border-t border-white/10">
          <div className="px-4 py-3">
            <p className="text-[13px] text-white">{props.userName}</p>
            <p className="text-[12px] text-white/60 truncate">{props.userEmail}</p>
          </div>
          <form action={props.signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 min-h-11 px-4 py-2.5 text-[13px] tracking-wide text-white/80 hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Uitloggen
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
