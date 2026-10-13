"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ListOrdered,
  ShoppingBag,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Trash2,
} from "lucide-react";
import { Drawer } from "@/components/ui/Dialog";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Producten", icon: Package },
  { href: "/admin/categories", label: "Categorieën", icon: ListOrdered },
  { href: "/admin/orders", label: "Bestellingen", icon: ShoppingBag },
  { href: "/admin/messages", label: "Berichten", icon: MessageSquare, badge: "messages" as const },
  { href: "/admin/trash", label: "Prullenbak", icon: Trash2 },
  { href: "/admin/settings", label: "Instellingen", icon: Settings },
];

const MOBILE_MENU_ID = "admin-mobile-menu";
// Zelfde grens als `lg:` in Tailwind: daarboven staat de vaste sidebar.
const DESKTOP_QUERY = "(min-width: 1024px)";

type Props = {
  userName: string;
  userEmail: string;
  /** Aantal contactberichten van de laatste 7 dagen. */
  messagesBadge?: number;
  signOutAction: () => Promise<void>;
};

/**
 * Admin-navigatie. Op lg+ een vaste donkere sidebar; daaronder een topbalk
 * met menuknop die een Drawer (native <dialog>) opent: de rest van de pagina
 * is dan automatisch inert, Escape sluit en de focus keert terug naar de knop.
 */
export default function AdminSidebar(props: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Route-wissel sluit het mobiele menu: "state aanpassen tijdens render"
  // (React-docs) in plaats van een effect met setState.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // Draait het scherm naar desktop terwijl het menu open is, dan sluiten:
  // de vaste sidebar staat er dan al en een modale dialog zou alles blokkeren.
  useEffect(() => {
    if (!mobileOpen) return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mobileOpen]);

  const badges: Record<string, number | undefined> = { messages: props.messagesBadge };

  const navigation = (
    <>
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
                  className={`flex items-center gap-3 min-h-11 px-4 py-2.5 text-base tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    isActive ? "bg-white/10 text-white" : "text-bone hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {item.label}
                  {badge != null && badge > 0 && (
                    <span
                      className="ml-auto inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-accent text-white text-sm tabular-nums"
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

      <div className="px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 border-t border-white/10">
        <div className="px-4 py-3">
          <p className="text-sm text-white">{props.userName}</p>
          <p className="text-sm text-mist truncate">{props.userEmail}</p>
        </div>
        <form action={props.signOutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 min-h-11 px-4 py-2.5 text-base tracking-wide text-bone hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Uitloggen
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Topbalk (< lg); bovenrand respecteert de notch/statusbalk (safe-area). */}
      <header className="lg:hidden sticky top-0 z-30 bg-ink text-white border-b border-white/10 pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="flex items-center justify-between py-2">
          <Link href="/admin" className="flex flex-col justify-center min-h-11">
            <p className="font-serif text-xl tracking-tight leading-none">Mokka</p>
            <p className="eyebrow-lg text-mist mt-0.5">Admin</p>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center justify-center w-11 h-11 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
            aria-label="Menu openen"
            aria-expanded={mobileOpen}
            aria-controls={MOBILE_MENU_ID}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <Drawer
        id={MOBILE_MENU_ID}
        side="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Admin-menu"
        className="!bg-ink !text-white w-72"
        header={
          <div className="flex items-center justify-between gap-4 px-7 pt-[max(2.25rem,env(safe-area-inset-top))] pb-7 border-b border-white/10 shrink-0">
            <Link href="/admin" className="block">
              <p className="font-serif text-2xl tracking-tight">Mokka</p>
              <p className="eyebrow-lg text-mist mt-0.5">Admin</p>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center w-11 h-11 -mr-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Menu sluiten"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        }
      >
        <div className="flex flex-col min-h-full">{navigation}</div>
      </Drawer>

      {/* Vaste sidebar (lg+). */}
      <aside
        aria-label="Admin-navigatie"
        className="hidden lg:flex fixed inset-y-0 left-0 z-20 w-64 bg-ink text-white flex-col pl-[env(safe-area-inset-left)]"
      >
        <div className="px-7 pt-9 pb-7 border-b border-white/10">
          <Link href="/admin" className="block">
            <p className="font-serif text-2xl tracking-tight">Mokka</p>
            <p className="eyebrow-lg text-mist mt-0.5">Admin</p>
          </Link>
        </div>
        {navigation}
      </aside>
    </>
  );
}
