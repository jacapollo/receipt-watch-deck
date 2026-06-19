import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { OfficeTag, PartyDot, OfficialAvatar, SectionHeader } from "@/components/polysnitch/Primitives";
import { states, districts, getOfficial } from "@/lib/mock-data";
import { X } from "lucide-react";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map · PolySnitch" },
      { name: "description", content: "Explore districts and the officials who represent them." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const [activeState, setActiveState] = useState<string | null>(null);
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);

  const districtsForState = activeState
    ? districts.filter((d) => d.stateCode === activeState)
    : [];
  const district = activeDistrict ? districts.find((d) => d.id === activeDistrict) : null;

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1600px] mx-auto">
        <SectionHeader
          eyebrow="GEO // DISTRICT EXPLORER"
          title="Map"
          right={
            <span className="mono-label hidden md:inline">
              {activeState ? `STATE · ${activeState}` : "SELECT A STATE"}
            </span>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="relative border border-border bg-surface rounded-sm overflow-hidden hud-grid">
            <div className="absolute top-3 left-3 mono-label text-amber z-10">
              SECTOR · NORTH AMERICA (DEMO)
            </div>
            {activeState && (
              <button
                onClick={() => {
                  setActiveState(null);
                  setActiveDistrict(null);
                }}
                className="absolute top-3 right-3 z-10 font-mono text-[10px] uppercase tracking-widest border border-border bg-surface px-2 py-1 rounded-sm text-muted-foreground hover:text-amber"
              >
                ← Zoom out
              </button>
            )}
            <svg viewBox="0 0 960 540" className="w-full h-auto block">
              <defs>
                <pattern id="hud" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="960" height="540" fill="url(#hud)" />

              {/* States */}
              {!activeState &&
                states.map((s) => (
                  <g key={s.code} className="cursor-pointer" onClick={() => setActiveState(s.code)}>
                    <path
                      d={s.d}
                      fill={s.color}
                      stroke="var(--color-border)"
                      strokeWidth="1.5"
                      className="hover:fill-[color:var(--color-surface-2)] transition-colors"
                    />
                    <text
                      x={s.d.split(" ")[1]}
                      y={(parseFloat(s.d.split(" ")[2]) || 0) + 30}
                      fill="var(--color-muted-foreground)"
                      fontFamily="var(--font-mono)"
                      fontSize="11"
                      letterSpacing="2"
                    >
                      {s.code}
                    </text>
                  </g>
                ))}

              {/* Districts of active state */}
              {activeState &&
                districtsForState.map((d) => (
                  <g
                    key={d.id}
                    className="cursor-pointer"
                    onClick={() => setActiveDistrict(d.id)}
                  >
                    <path
                      d={d.d}
                      fill={activeDistrict === d.id ? "var(--color-amber)" : "var(--color-surface-2)"}
                      stroke={activeDistrict === d.id ? "var(--color-amber)" : "var(--color-border)"}
                      strokeWidth="1.5"
                      fillOpacity={activeDistrict === d.id ? 0.35 : 1}
                      className="hover:stroke-[color:var(--color-cyan)] transition"
                    />
                    <text
                      x={parseFloat(d.d.split(" ")[1]) + 8}
                      y={parseFloat(d.d.split(" ")[2]) + 16}
                      fill="var(--color-muted-foreground)"
                      fontFamily="var(--font-mono)"
                      fontSize="9"
                      letterSpacing="1.5"
                    >
                      {d.id}
                    </text>
                  </g>
                ))}
            </svg>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>GRID · ILLUSTRATIVE</span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
                LIVE FEED
              </span>
            </div>
          </div>

          {/* District panel */}
          <aside className="border border-border bg-surface rounded-sm p-4 min-h-[400px]">
            {!district && (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="mono-label text-amber">NO DISTRICT SELECTED</div>
                <p className="mt-3 text-sm text-muted-foreground max-w-xs">
                  {activeState
                    ? "Tap a district on the map to see who represents it."
                    : "Tap a state to drill in."}
                </p>
              </div>
            )}
            {district && (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mono-label text-cyan">DISTRICT DOSSIER</div>
                    <h3 className="text-lg font-bold mt-1">{district.name}</h3>
                    <div className="mono-label mt-1">
                      LEVEL · {district.level.toUpperCase()}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveDistrict(null)}
                    className="text-muted-foreground hover:text-amber"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 mono-label">REPRESENTED BY</div>
                <ul className="mt-2 space-y-2">
                  {district.officialIds.map((id) => {
                    const o = getOfficial(id);
                    if (!o) return null;
                    return (
                      <li key={id}>
                        <Link
                          to="/officials/$id"
                          params={{ id }}
                          className="flex items-center gap-3 p-2 -mx-2 rounded-sm hover:bg-surface-2 group"
                        >
                          <OfficialAvatar official={o} size={40} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate group-hover:text-amber">
                                {o.name}
                              </span>
                              <PartyDot party={o.party} />
                            </div>
                            <OfficeTag level={o.level} text={o.office} />
                          </div>
                          <span className="mono-label group-hover:text-amber">OPEN →</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
