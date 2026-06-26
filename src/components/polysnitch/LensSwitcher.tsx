import { Link } from "@tanstack/react-router";
import { LayoutDashboard, DollarSign, Vote, ScrollText, Radio } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type LensId = "overview" | "money" | "votes" | "bills" | "feed";

type LensDef = {
  id: LensId;
  label: string;
  to?: "/dashboard" | "/money" | "/bills" | "/feed";
  icon: LucideIcon;
  soon?: boolean;
};

const LENSES: LensDef[] = [
  { id: "overview", label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { id: "money", label: "Money", to: "/money", icon: DollarSign },
  { id: "votes", label: "Votes", icon: Vote, soon: true },
  { id: "bills", label: "Bills", to: "/bills", icon: ScrollText },
  { id: "feed", label: "Feed", to: "/feed", icon: Radio },
];

export function LensSwitcher({ active }: { active: LensId }) {
  return (
    <div className="mb-6 flex items-center gap-2 flex-wrap">
      <span className="mono-label mr-1 hidden sm:inline">LENS</span>
      {LENSES.map((l) => {
        const Icon = l.icon;
        const base =
          "inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest border rounded-sm transition";
        if (l.id === active) {
          return (
            <span
              key={l.id}
              className={`${base} bg-amber text-primary-foreground border-amber`}
            >
              <Icon className="h-3 w-3" />
              {l.label}
            </span>
          );
        }
        if (l.soon) {
          return (
            <button
              key={l.id}
              disabled
              aria-disabled
              className={`${base} border-border text-muted-foreground/60 cursor-not-allowed`}
            >
              <Icon className="h-3 w-3" />
              {l.label}
              <span className="ml-1 px-1 py-px text-[9px] tracking-widest border border-border rounded-[2px] text-muted-foreground">
                SOON
              </span>
            </button>
          );
        }
        return (
          <Link
            key={l.id}
            to={l.to!}
            className={`${base} border-border text-muted-foreground hover:text-foreground hover:border-amber/60 hover:bg-surface-2`}
          >
            <Icon className="h-3 w-3" />
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
