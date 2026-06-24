import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Radio,
  Map,
  Users,
  ScrollText,
  MessagesSquare,
  UserCircle2,
  Radar,
} from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/feed", label: "Feed", icon: Radio },
  { to: "/map", label: "Map", icon: Map },
  { to: "/officials", label: "Officials", icon: Users },
  { to: "/bills", label: "Bills", icon: ScrollText },
  { to: "/discuss", label: "Discuss", icon: MessagesSquare },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
] as const;

// Mobile bottom nav: keep room for all primary sections by moving Profile
// to the desktop sidebar / top-level only.
const mobileNav = nav.filter((n) => n.to !== "/profile");

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface sticky top-0 h-screen">
        <Link to="/" className="px-5 py-5 border-b border-border block group">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-amber group-hover:rotate-45 transition-transform" />
            <span className="font-black text-lg tracking-tight">POLY<span className="text-amber">SNITCH</span></span>
          </div>
          <div className="mono-label mt-1">v0.1 // public record</div>
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
                  <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-amber">
                    ●
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

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
          to="/profile"
          className="mono-label text-muted-foreground hover:text-amber flex items-center gap-1.5"
        >
          <UserCircle2 className="h-3.5 w-3.5" />
          PROFILE
        </Link>
      </div>

      <main className="flex-1 min-w-0 pt-12 md:pt-0 pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-20 border-t border-border bg-surface grid grid-cols-6 pb-[env(safe-area-inset-bottom)]">
        {mobileNav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-1 px-1 py-2 min-w-0 ${
                active ? "text-amber" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="font-mono uppercase tracking-wider text-[9px] leading-none truncate max-w-full">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
