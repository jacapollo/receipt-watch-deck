import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Radio,
  Map,
  Users,
  ScrollText,
  Gavel,
  Banknote,
  UserCircle2,
  Radar,
  Home,
  MoreHorizontal,
  Info,
  X,
  LogIn,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

// Desktop sidebar list. Discuss dropped (hidden for launch); About added so the
// methodology page is reachable on desktop too.
const nav = [
  { to: "/feed", label: "Feed", icon: Radio },
  { to: "/map", label: "Map", icon: Map },
  { to: "/officials", label: "Officials", icon: Users },
  { to: "/bills", label: "Bills", icon: ScrollText },
  { to: "/votes", label: "Votes", icon: Gavel },
  { to: "/money", label: "Money", icon: Banknote },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
  { to: "/about", label: "About", icon: Info },
] as const;

// Mobile bottom bar: 4 primary destinations + a "More" sheet (5 slots max).
// Home ("/") is the dashboard; Money is promoted top-level as the signature
// lens. Officials, the other lenses, About, and Profile live in More.
const mobilePrimary = [
  { to: "/", label: "Home", icon: Home },
  { to: "/feed", label: "Feed", icon: Radio },
  { to: "/map", label: "Map", icon: Map },
  { to: "/money", label: "Money", icon: Banknote },
] as const;

const mobileMore = [
  { to: "/officials", label: "Officials", icon: Users },
  { to: "/votes", label: "Votes", icon: Gavel },
  { to: "/bills", label: "Bills", icon: ScrollText },
  { to: "/about", label: "About", icon: Info },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
] as const;

// Home matches only "/" exactly; every other route matches self or subpaths.
const isActive = (pathname: string, to: string) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useAuth();

  // Close the More sheet whenever the route changes.
  useEffect(() => setMoreOpen(false), [pathname]);

  const moreActive = mobileMore.some((m) => isActive(pathname, m.to));

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface sticky top-0 h-screen">
        <Link to="/" className="px-5 py-5 border-b border-border block group">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-amber group-hover:rotate-45 transition-transform" />
            <span className="font-black text-lg tracking-tight">POLY<span className="text-amber">SNITCH</span></span>
          </div>
          <div className="mono-label mt-1">v0.1 // watchfloor</div>
        </Link>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition border-l-2 ${
                  active
                    ? "bg-surface-2 text-foreground border-amber"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-surface-2"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {active && (
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-amber">
                    ●
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Account state */}
        <Link
          to="/login"
          className="px-4 py-3 border-t border-border flex items-center gap-2.5 group hover:bg-surface-2 transition"
        >
          <UserCircle className={`h-5 w-5 shrink-0 ${user ? "text-status-green" : "text-muted-foreground group-hover:text-amber"}`} />
          <div className="min-w-0">
            {user ? (
              <>
                <div className="mono-label text-status-green">SIGNED IN</div>
                <div className="text-[12px] text-foreground truncate">{user.email}</div>
              </>
            ) : (
              <>
                <div className="mono-label group-hover:text-amber">GUEST // PUBLIC ACCESS</div>
                <div className="text-[12px] text-muted-foreground">Sign in / create account</div>
              </>
            )}
          </div>
        </Link>

        <div className="px-4 py-3 border-t border-border">
          <div className="mono-label text-status-green flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
            LIVE // PUBLIC RECORD
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
            We track the public record of public officials only.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-12 border-b border-border bg-surface flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-amber" />
          <span className="font-black text-sm tracking-tight">POLY<span className="text-amber">SNITCH</span></span>
        </Link>
        <Link
          to="/login"
          aria-label={user ? "Account" : "Sign in"}
          className="flex items-center gap-1.5 mono-label"
        >
          {user ? (
            <>
              <UserCircle className="h-4 w-4 text-status-green" />
              <span className="text-status-green">ACCOUNT</span>
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">SIGN IN</span>
            </>
          )}
        </Link>
      </div>

      <main className="flex-1 min-w-0 pt-12 md:pt-0 pb-16 md:pb-0">{children}</main>

      {/* Mobile "More" sheet (overflow destinations) */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute bottom-0 inset-x-0 border-t border-border bg-surface rounded-t-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="mono-label text-amber">MORE // LENSES + ARCHIVE</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground p-1 -mr-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {mobileMore.map((item) => {
                const active = isActive(pathname, item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-sm border transition ${
                      active
                        ? "border-amber text-amber bg-surface-2"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-mono text-[11px] uppercase tracking-wider">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav — 4 primary + More (5 slots max) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 border-t border-border bg-surface grid grid-cols-5">
        {mobilePrimary.map((item) => {
          const active = isActive(pathname, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-1 px-0.5 min-w-0 ${
                active ? "text-amber" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="font-mono text-[10px] uppercase tracking-wide leading-none max-w-full truncate">
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          aria-expanded={moreOpen}
          className={`flex flex-col items-center justify-center gap-1 px-0.5 min-w-0 ${
            moreActive || moreOpen ? "text-amber" : "text-muted-foreground"
          }`}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-wide leading-none">More</span>
        </button>
      </nav>
    </div>
  );
}
