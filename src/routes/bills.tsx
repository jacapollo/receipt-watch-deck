import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  BillStatusPill,
  LevelFilterBar,
  OfficeTag,
  OfficialAvatar,
  SectionHeader,
} from "@/components/polysnitch/Primitives";
import { bills, getOfficial, formatTimeAgo } from "@/lib/mock-data";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/bills")({
  head: () => ({
    meta: [
      { title: "Bills & Issues · PolySnitch" },
      { name: "description", content: "Track bills and how officials voted on them." },
    ],
  }),
  component: BillsPage,
});

function BillsPage() {
  const [level, setLevel] = useState<"all" | "federal" | "state" | "local">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  const allTags = useMemo(
    () => Array.from(new Set(bills.flatMap((b) => b.tags))).sort(),
    [],
  );

  const list = bills
    .filter((b) => level === "all" || b.level === level)
    .filter((b) => !tag || b.tags.includes(tag));

  const toggleFollow = (id: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
        <SectionHeader
          eyebrow="LEGISLATION // TRACKER"
          title="Bills & Issues"
          right={<span className="mono-label hidden md:inline">{list.length} BILLS</span>}
        />

        <div className="space-y-3 mb-5">
          <LevelFilterBar value={level} onChange={setLevel} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="mono-label mr-1">TAGS</span>
            <button
              onClick={() => setTag(null)}
              className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border rounded-[2px] transition ${
                !tag ? "bg-cyan/10 border-cyan/50 text-cyan" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              ALL
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t === tag ? null : t)}
                className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border rounded-[2px] transition ${
                  tag === t
                    ? "bg-cyan/10 border-cyan/50 text-cyan"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {list.map((b) => {
            const isOpen = open === b.id;
            const isFollowed = followed.has(b.id);
            return (
              <article
                key={b.id}
                className="border border-border bg-surface rounded-sm overflow-hidden"
              >
                <div className="p-4 md:p-5">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setOpen(isOpen ? null : b.id)}
                      className="mt-1 text-muted-foreground hover:text-amber shrink-0"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <BillStatusPill status={b.status} />
                        <span className="mono-label">
                          {b.level.toUpperCase()} · INTRO {formatTimeAgo(b.introduced)} AGO
                        </span>
                      </div>
                      <h3 className="mt-2 text-base md:text-lg font-bold">{b.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{b.summary}</p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {b.tags.map((t) => (
                          <span
                            key={t}
                            className="font-mono text-[10px] uppercase tracking-widest text-cyan border border-cyan/40 px-1.5 py-0.5 rounded-[2px]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFollow(b.id)}
                      className={`shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 border rounded-sm transition ${
                        isFollowed
                          ? "bg-amber text-primary-foreground border-amber"
                          : "border-border text-muted-foreground hover:text-amber hover:border-amber"
                      }`}
                    >
                      <Star className={`h-3 w-3 ${isFollowed ? "fill-current" : ""}`} />
                      {isFollowed ? "Tracking" : "Track"}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border bg-surface-2/40 p-4 md:p-5 space-y-4">
                    <div>
                      <div className="mono-label text-amber mb-2">SPONSORS</div>
                      <div className="flex flex-wrap gap-2">
                        {b.sponsors.map((sid) => {
                          const o = getOfficial(sid);
                          if (!o) return null;
                          return (
                            <Link
                              key={sid}
                              to="/officials/$id"
                              params={{ id: sid }}
                              className="flex items-center gap-2 border border-border bg-surface rounded-sm px-2 py-1.5 hover:border-amber"
                            >
                              <OfficialAvatar official={o} size={24} />
                              <div className="leading-tight">
                                <div className="text-xs font-semibold">{o.name}</div>
                                <OfficeTag level={o.level} text={o.district} />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    {b.votes && b.votes.length > 0 && (
                      <div>
                        <div className="mono-label text-cyan mb-2">WHO VOTED HOW</div>
                        <ul className="divide-y divide-border border border-border rounded-sm bg-surface">
                          {b.votes.map((v) => {
                            const o = getOfficial(v.officialId);
                            if (!o) return null;
                            const voteColor =
                              v.vote === "Yea"
                                ? "text-status-green border-status-green/50 bg-status-green/10"
                                : v.vote === "Nay"
                                  ? "text-status-red border-status-red/50 bg-status-red/10"
                                  : "text-muted-foreground border-border";
                            return (
                              <li key={v.officialId} className="flex items-center gap-3 px-3 py-2">
                                <OfficialAvatar official={o} size={28} />
                                <div className="min-w-0 flex-1">
                                  <Link
                                    to="/officials/$id"
                                    params={{ id: o.id }}
                                    className="text-sm font-medium hover:text-amber truncate block"
                                  >
                                    {o.name}
                                  </Link>
                                  <OfficeTag level={o.level} text={o.district} />
                                </div>
                                <span
                                  className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded-[2px] ${voteColor}`}
                                >
                                  {v.vote}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
