import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { AppShell } from "@/components/layout/AppShell";
import { OfficeTag, PartyDot, OfficialAvatar, SectionHeader } from "@/components/polysnitch/Primitives";
import { states, districts, getOfficial } from "@/lib/mock-data";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map · PolySnitch" },
      { name: "description", content: "Explore districts and the officials who represent them." },
    ],
  }),
  component: MapPage,
});

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// FIPS (numeric, zero-padded) → USPS two-letter code
const FIPS_TO_CODE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
};

const STATE_NAMES: Record<string, string> = Object.fromEntries(
  states.map((s) => [s.code, s.name]),
);

function MapPage() {
  const [activeState, setActiveState] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const statesWithData = useMemo(() => new Set(states.map((s) => s.code)), []);
  const districtsForState = activeState
    ? districts.filter((d) => d.stateCode === activeState)
    : [];

  const activeStateName = activeState
    ? STATE_NAMES[activeState] ?? activeState
    : null;

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-8 max-w-[1600px] mx-auto">
        <SectionHeader
          eyebrow="GEO // DISTRICT EXPLORER"
          title="Map"
          right={
            <span className="mono-label hidden md:inline">
              {activeState ? `STATE · ${activeState}` : "SELECT A STATE"}
            </span>
          }
        />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="relative border border-border rounded-sm overflow-hidden hud-grid">
            <div className="absolute inset-0 bg-black/60 z-0" />
            <div className="absolute top-3 left-3 mono-label text-amber z-10">
              REGION · NORTH AMERICA (DEMO)
            </div>
            {activeState && (
              <button
                onClick={() => setActiveState(null)}
                className="absolute top-3 right-3 z-10 font-mono text-[10px] uppercase tracking-widest border border-border bg-surface px-2 py-1 rounded-sm text-muted-foreground hover:text-amber"
              >
                ← Zoom out
              </button>
            )}

            <div className="relative z-[1] w-full">
              <ComposableMap
                projection="geoAlbersUsa"
                projectionConfig={{ scale: 1000 }}
                width={960}
                height={540}
                style={{ width: "100%", height: "auto", display: "block" }}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const fips = String(geo.id).padStart(2, "0");
                      const code = FIPS_TO_CODE[fips];
                      const hasData = code ? statesWithData.has(code) : false;
                      const isActive = code && activeState === code;
                      const isHovered = code && hovered === code;

                      const baseFill = hasData
                        ? "var(--color-surface-2)"
                        : "var(--color-surface)";
                      const hoverFill = "var(--color-surface-2)";

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={() => code && setActiveState(code)}
                          onMouseEnter={() => code && setHovered(code)}
                          onMouseLeave={() => setHovered(null)}
                          vectorEffect="non-scaling-stroke"
                          style={{
                            default: {
                              fill: isActive ? "var(--color-amber)" : baseFill,
                              fillOpacity: isActive ? 0.35 : hasData ? 1 : 0.55,
                              stroke: isActive
                                ? "var(--color-amber)"
                                : "rgba(180, 190, 200, 0.55)",
                              strokeWidth: isActive ? 1 : 0.9,
                              outline: "none",
                              cursor: code ? "pointer" : "default",
                              transition: "fill 120ms, fill-opacity 120ms",
                            },
                            hover: {
                              fill: isActive
                                ? "var(--color-amber)"
                                : isHovered
                                  ? "var(--color-cyan)"
                                  : hoverFill,
                              fillOpacity: isActive ? 0.45 : isHovered ? 0.18 : 1,
                              stroke: isActive
                                ? "var(--color-amber)"
                                : "rgba(210, 220, 230, 0.85)",
                              strokeWidth: 1,
                              outline: "none",
                              cursor: "pointer",
                            },
                            pressed: {
                              fill: "var(--color-amber)",
                              fillOpacity: 0.5,
                              stroke: "var(--color-amber)",
                              strokeWidth: 1,
                              outline: "none",
                            },
                          }}
                        />

                      );
                    })
                  }
                </Geographies>
              </ComposableMap>
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground z-10">
              <span>GRID · US STATES</span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
                LIVE FEED
              </span>
            </div>
          </div>

          {/* State panel */}
          <aside className="border border-border bg-surface rounded-sm p-5 min-h-[400px]">
            {!activeState && (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="mono-label text-amber">NO STATE SELECTED</div>
                <p className="mt-3 text-sm text-muted-foreground max-w-xs">
                  Tap a state to zoom in.
                </p>
              </div>
            )}
            {activeState && (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mono-label text-cyan">STATE PROFILE</div>
                    <h3 className="text-lg font-bold mt-1">{activeStateName}</h3>
                    <div className="mono-label mt-1">CODE · {activeState}</div>
                  </div>
                </div>

                {districtsForState.length === 0 && (
                  <p className="mt-6 text-sm text-muted-foreground">
                    No records yet for {activeStateName} — sample coverage is currently CA, TX, NY, and FL.
                  </p>
                )}

                {districtsForState.length > 0 && (
                  <div className="mt-5 space-y-5">
                    {districtsForState.map((d) => (
                      <div key={d.id}>
                        <div className="mono-label text-cyan">{d.id}</div>
                        <div className="text-sm font-semibold mt-0.5">{d.name}</div>
                        <div className="mono-label mt-0.5">
                          LEVEL · {d.level.toUpperCase()}
                        </div>
                        <ul className="mt-2 space-y-2">
                          {d.officialIds.map((id) => {
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
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
