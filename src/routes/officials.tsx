import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  OfficialAvatar,
  OfficeTag,
  PartyDot,
  LevelFilterBar,
  SectionHeader,
} from "@/components/polysnitch/Primitives";
import { officials } from "@/lib/mock-data";
import { Search } from "lucide-react";

export const Route = createFileRoute("/officials")({
  head: () => ({
    meta: [
      { title: "Officials · PolySnitch" },
      { name: "description", content: "Browse officials and open their dossier." },
    ],
  }),
  component: OfficialsPage,
});

function OfficialsPage() {
  const [level, setLevel] = useState<"all" | "federal" | "state" | "local">("all");
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      officials
        .filter((o) => level === "all" || o.level === level)
        .filter(
          (o) =>
            !q ||
            o.name.toLowerCase().includes(q.toLowerCase()) ||
            o.district.toLowerCase().includes(q.toLowerCase()) ||
            o.office.toLowerCase().includes(q.toLowerCase()),
        ),
    [level, q],
  );

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1600px] mx-auto">
        <SectionHeader
          eyebrow="ROSTER // SUBJECTS"
          title="Officials"
          right={<span className="mono-label hidden md:inline">{list.length} SUBJECTS</span>}
        />

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <LevelFilterBar value={level} onChange={setLevel} />
          <div className="flex items-center gap-2 border border-border bg-surface rounded-sm px-3 py-1.5 flex-1 min-w-[200px] max-w-md focus-within:border-amber">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, office, district…"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((o) => (
            <Link
              key={o.id}
              to="/officials/$id"
              params={{ id: o.id }}
              className="group border border-border bg-surface hover:border-amber/60 rounded-sm p-4 transition"
            >
              <div className="flex items-start gap-3">
                <OfficialAvatar official={o} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate group-hover:text-amber">
                      {o.name}
                    </span>
                    <PartyDot party={o.party} />
                  </div>
                  <OfficeTag level={o.level} text={o.district} />
                  <div className="mt-1 text-xs text-muted-foreground">{o.office}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <div>
                  <div className="text-foreground font-bold text-sm">{o.stats.billsSponsored}</div>
                  bills
                </div>
                <div>
                  <div className="text-foreground font-bold text-sm">{o.stats.attendance}%</div>
                  attend
                </div>
                <div className="truncate">
                  <div className="text-cyan font-bold text-sm truncate">{o.stats.topSector.split(" / ")[0]}</div>
                  top sector
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
