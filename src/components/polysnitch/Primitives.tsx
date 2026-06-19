import { Link } from "@tanstack/react-router";
import {
  ExternalLink,
  MessageSquare,
  ArrowBigUp,
  Flag,
  type LucideIcon,
} from "lucide-react";
import type {
  Official,
  OfficialAction,
  ActionType,
  Party,
  BillStatus,
} from "@/lib/mock-data";
import { formatStamp, formatTimeAgo, partyColor } from "@/lib/mock-data";

/* ------------- OfficialAvatar ------------- */
export function OfficialAvatar({
  official,
  size = 40,
}: {
  official: Pick<Official, "name" | "photoSeed" | "party">;
  size?: number;
}) {
  const initials = official.name
    .replace(/^(Sen\.|Rep\.|Gov\.|Asm\.|Mayor|Councilmember|State Sen\.|State Rep\.)\s*/i, "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      className="relative shrink-0 grid place-items-center rounded-sm font-mono font-bold bg-surface-2 border border-border overflow-hidden"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      <span className="text-foreground/80">{initials}</span>
      <span
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ background: partyColor(official.party) }}
      />
    </div>
  );
}

/* ------------- ActionTypeChip ------------- */
const typeStyles: Record<ActionType, string> = {
  VOTE: "text-amber border-amber/50 bg-amber/10",
  BILL: "text-cyan border-cyan/50 bg-cyan/10",
  STATEMENT: "text-status-yellow border-status-yellow/50 bg-status-yellow/10",
  FUNDING: "text-status-green border-status-green/50 bg-status-green/10",
  "PUBLIC EVENT": "text-muted-foreground border-border bg-surface-2",
};
export function ActionTypeChip({ type }: { type: ActionType }) {
  return (
    <span
      className={`inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border rounded-[2px] ${typeStyles[type]}`}
    >
      {type}
    </span>
  );
}

/* ------------- OfficeTag ------------- */
export function OfficeTag({
  level,
  text,
}: {
  level: "federal" | "state" | "local";
  text: string;
}) {
  const color =
    level === "federal"
      ? "text-amber"
      : level === "state"
        ? "text-cyan"
        : "text-foreground";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-widest ${color}`}>
      {level === "federal" ? "FED" : level === "state" ? "STATE" : "LOCAL"} · {text}
    </span>
  );
}

/* ------------- PartyDot ------------- */
export function PartyDot({ party }: { party: Party }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: partyColor(party) }}
      title={party === "D" ? "Democratic" : party === "R" ? "Republican" : "Independent"}
    />
  );
}

/* ------------- SourceTag ------------- */
export function SourceTag({ source, url }: { source: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-cyan border border-border hover:border-cyan px-1.5 py-0.5 rounded-[2px] transition"
      onClick={(e) => e.stopPropagation()}
    >
      SRC · {source}
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

/* ------------- ActionCard ------------- */
export function ActionCard({
  action,
  official,
  compact = false,
}: {
  action: OfficialAction;
  official: Official;
  compact?: boolean;
}) {
  return (
    <article
      className={`group border border-border bg-surface hover:border-amber/40 hover:bg-surface-2/60 transition rounded-sm p-4 ${
        compact ? "" : "md:p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        <Link to="/officials/$id" params={{ id: official.id }}>
          <OfficialAvatar official={official} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <Link
              to="/officials/$id"
              params={{ id: official.id }}
              className="font-semibold text-foreground hover:text-amber truncate"
            >
              {official.name}
            </Link>
            <PartyDot party={official.party} />
            <OfficeTag level={official.level} text={official.district} />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ActionTypeChip type={action.type} />
            <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
              {formatStamp(action.timestamp)} · {formatTimeAgo(action.timestamp)}
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground leading-snug">{action.summary}</p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <SourceTag source={action.source} url={action.sourceUrl} />
            <span className="ml-auto flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowBigUp className="h-3.5 w-3.5" />
                {action.upvotes}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {action.comments}
              </span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------- StatTile ------------- */
export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "default" | "amber" | "cyan" | "green" | "red" | "yellow";
}) {
  const toneClass = {
    default: "text-foreground",
    amber: "text-amber",
    cyan: "text-cyan",
    green: "text-status-green",
    red: "text-status-red",
    yellow: "text-status-yellow",
  }[tone];
  return (
    <div className="border border-border bg-surface rounded-sm p-3 md:p-4 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="mono-label">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className={`mt-2 text-2xl md:text-3xl font-black tracking-tight ${toneClass}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {sub}
        </div>
      )}
      <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-amber/20 to-transparent" />
    </div>
  );
}

/* ------------- BillStatusPill ------------- */
export function BillStatusPill({ status }: { status: BillStatus }) {
  const map: Record<BillStatus, string> = {
    Introduced: "text-muted-foreground border-border",
    "In Committee": "text-status-yellow border-status-yellow/50 bg-status-yellow/10",
    Passed: "text-cyan border-cyan/50 bg-cyan/10",
    Signed: "text-status-green border-status-green/50 bg-status-green/10",
    Failed: "text-status-red border-status-red/50 bg-status-red/10",
  };
  return (
    <span
      className={`inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border rounded-[2px] ${map[status]}`}
    >
      {status}
    </span>
  );
}

/* ------------- ReportButton ------------- */
export function ReportButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-status-red transition"
    >
      <Flag className="h-3 w-3" />
      Report
    </button>
  );
}

/* ------------- LevelFilterBar ------------- */
export function LevelFilterBar({
  value,
  onChange,
  location,
}: {
  value: "all" | "federal" | "state" | "local";
  onChange: (v: "all" | "federal" | "state" | "local") => void;
  location?: string;
}) {
  const opts: { id: "all" | "federal" | "state" | "local"; label: string }[] = [
    { id: "local", label: "Local" },
    { id: "state", label: "State" },
    { id: "federal", label: "Federal" },
    { id: "all", label: "All" },
  ];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex border border-border bg-surface rounded-sm overflow-hidden">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
              value === o.id
                ? "bg-amber text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {location && (
        <span className="inline-flex items-center gap-2 border border-border bg-surface px-3 py-1.5 rounded-sm font-mono text-[11px] uppercase tracking-widest">
          <span className="h-1.5 w-1.5 bg-cyan rounded-full" />
          LOC · {location}
          <button className="text-muted-foreground hover:text-amber ml-1">edit</button>
        </span>
      )}
    </div>
  );
}

/* ------------- SectionHeader ------------- */
export function SectionHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-4 border-b border-border pb-2 gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="mono-label text-amber">{eyebrow}</div>}
        <h2 className="text-xl md:text-2xl font-bold tracking-tight truncate">{title}</h2>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
