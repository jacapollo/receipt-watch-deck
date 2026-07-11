import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { OfficeTag, PartyDot, OfficialAvatar, SectionHeader } from "@/components/polysnitch/Primitives";
import { usStates, usGraticuleD, px500km } from "@/lib/us-states";
import {
  fetchRepresentativesIndex,
  fetchZipDistricts,
  levelOf,
  officialSlug,
  toPartyCode,
  type RepIndexRow,
  type ZipDistrictRow,
} from "@/lib/records";
import { supabaseConfigured } from "@/lib/supabase";
import { ArrowLeft, Search } from "lucide-react";

type DistrictType = ZipDistrictRow["district_type"];
const TYPE_META: Record<DistrictType, { label: string; level: string; chamber: string }> = {
  congressional: { label: "U.S. House", level: "federal", chamber: "lower" },
  senate: { label: "State Senate", level: "state", chamber: "upper" },
  house: { label: "State House", level: "state", chamber: "lower" },
};
const TYPE_ORDER: DistrictType[] = ["congressional", "senate", "house"];
const districtLabel = (t: DistrictType, id: string) => (t === "congressional" ? id : `District ${id}`);
// note: 1 result -> plain label; multiple -> "Primarily" (highest weight) / "Also overlaps"
function weightNote(t: DistrictType, id: string, weight: number | undefined, i: number, count: number): string {
  const dl = districtLabel(t, id);
  // sub-0.1% slivers would render as "0.0%"; show "<0.1%" instead (never hidden)
  const pctVal = weight != null ? weight * 100 : null;
  const pct = pctVal != null ? ` · ${pctVal > 0 && pctVal < 0.1 ? "<0.1" : pctVal.toFixed(1)}%` : "";
  if (count <= 1) return `${dl}${pct}`;
  return `${i === 0 ? `Primarily ${dl}` : `Also overlaps ${dl}`}${pct}`;
}
type DistrictResult = { type: DistrictType; district_id: string; weight?: number };

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Find your representatives · PolySnitch" },
      { name: "description", content: "Select your Florida districts to see who represents you." },
    ],
  }),
  component: MapPage,
});

const distNum = (d: string | null): number => {
  const m = (d ?? "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 9999;
};

function MapPage() {
  const [activeState, setActiveState] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
        <SectionHeader
          eyebrow="GEO // FIND YOUR REPS"
          title="Find your representatives"
          right={
            <span className="mono-label hidden md:inline">
              {activeState ? `STATE · ${activeState}` : "SELECT A STATE"}
            </span>
          }
        />

        {activeState === "FL" ? (
          <FloridaFinder onBack={() => setActiveState(null)} />
        ) : activeState ? (
          <ComingSoon state={activeState} onBack={() => setActiveState(null)} />
        ) : (
          <StateSelect onSelect={setActiveState} />
        )}
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 — pick a state on the existing US map. FL advances; others = soon.  */
/* -------------------------------------------------------------------------- */

// tiny NE states whose centroids collide at this size — no room for labels
const NO_LABEL = new Set(["DC", "RI", "CT", "NJ", "DE", "MD", "MA", "NH", "VT"]);

function StateSelect({ onSelect }: { onSelect: (code: string) => void }) {
  return (
    <>
      <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
        Select your state to find who represents you. Florida is live; other states are coming soon.
      </p>
      {/* The SVG IS the map (single AlbersUSA projection). The tactical chrome is
          HTML overlaid around it — pointer-events-none so clicks reach the SVG. */}
      <div className="relative border border-border rounded-sm overflow-hidden bg-[#050505]">
        <svg viewBox="0 0 960 540" className="relative z-[5] w-full h-auto block">
          <defs>
            <pattern id="hud" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="960" height="540" fill="url(#hud)" />
          {/* graticule — same projection as the states, so everything registers */}
          <path d={usGraticuleD} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" strokeDasharray="2 4" />
          {/* non-live states (background), FL painted last so it sits on top */}
          {usStates.filter((s) => s.code !== "FL").map((s) => (
            <g key={s.code}>
              <path d={s.d} fill="#141a26" fillOpacity={0.8} stroke="rgba(148,163,184,0.28)" strokeWidth={0.7} />
              {!NO_LABEL.has(s.code) && (
                <text
                  x={s.cx}
                  y={s.cy}
                  textAnchor="middle"
                  fill="rgba(148,163,184,0.4)"
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  letterSpacing="1.5"
                >
                  {s.code}
                </text>
              )}
            </g>
          ))}
          {usStates
            .filter((s) => s.code === "FL")
            .map((s) => (
              <g key={s.code} className="cursor-pointer" onClick={() => onSelect(s.code)}>
                <path
                  d={s.d}
                  fill="var(--color-amber)"
                  fillOpacity={0.5}
                  stroke="var(--color-amber)"
                  strokeWidth={2.5}
                  className="hover:fill-opacity-80 transition"
                />
                <text
                  x={s.cx + 16}
                  y={s.cy}
                  fill="var(--color-amber)"
                  fontFamily="var(--font-mono)"
                  fontSize="12"
                  letterSpacing="2"
                >
                  FL ●
                </text>
              </g>
            ))}
          {/* scale bar lives in the SVG so it stays truthful when the map scales */}
          <g fontFamily="var(--font-mono)" fontSize="9" fill="rgba(148,163,184,0.6)">
            <line x1={940 - px500km} y1={516} x2={940} y2={516} stroke="rgba(148,163,184,0.6)" strokeWidth="1" />
            <line x1={940 - px500km} y1={512} x2={940 - px500km} y2={520} stroke="rgba(148,163,184,0.6)" strokeWidth="1" />
            <line x1={940 - Math.round(px500km / 2)} y1={513} x2={940 - Math.round(px500km / 2)} y2={519} stroke="rgba(148,163,184,0.6)" strokeWidth="1" />
            <line x1={940} y1={512} x2={940} y2={520} stroke="rgba(148,163,184,0.6)" strokeWidth="1" />
            <text x={940 - px500km} y={508} textAnchor="middle">0</text>
            <text x={940} y={508} textAnchor="middle">500 KM</text>
          </g>
        </svg>

        {/* ---- tactical chrome (HTML, pointer-events-none) ---- */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">CLASSIFIED // LEVEL 1</div>
          <div className="mono-label text-amber">SECTOR · NORTH AMERICA (DEMO)</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">PROJ: ALBERS USA · UNITS: KM</div>
        </div>
        <div className="absolute top-3 right-3 z-10 pointer-events-none hidden sm:block border border-border/60 bg-black/60 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground space-y-0.5">
          <div>LINK: 100%</div>
          <div>CONNECTION: SATCOM</div>
          <div>ENCRYPTION: AES-256</div>
          <div>TRACKING: ENABLED</div>
        </div>
        {/* anchored in the Atlantic (land ends x<=800 below y=340 in the viewBox;
            this column sits right-3 / above the scale bar so it stays in open water) */}
        <div className="absolute right-3 bottom-11 z-10 pointer-events-none hidden lg:flex flex-col items-end gap-1.5">
          <div className="border border-border/60 bg-black/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground space-y-0.5">
            <div className="text-amber/80">COORDINATE REFERENCE</div>
            <div>DATUM: WGS 84</div>
            <div>PROJECTION: ALBERS USA</div>
            <div>SOURCE: CENSUS TIGER 2020</div>
          </div>
          {/* compass */}
          <svg viewBox="0 0 48 48" className="w-10 h-10 border border-border/60 bg-black/60">
            <circle cx="24" cy="24" r="15" fill="none" stroke="rgba(148,163,184,0.4)" strokeWidth="0.8" />
            <line x1="24" y1="9" x2="24" y2="39" stroke="rgba(148,163,184,0.3)" strokeWidth="0.6" />
            <line x1="9" y1="24" x2="39" y2="24" stroke="rgba(148,163,184,0.3)" strokeWidth="0.6" />
            <path d="M24 12 L26 22 L24 20 L22 22 Z" fill="var(--color-amber)" fillOpacity="0.8" />
            <text x="24" y="8" textAnchor="middle" fontSize="6" fill="rgba(148,163,184,0.7)" fontFamily="var(--font-mono)">N</text>
          </svg>
          <div className="border border-border/60 bg-black/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground space-y-0.5">
            <div className="text-amber/80">NOTES</div>
            <div>1. PUBLIC RECORDS ONLY</div>
            <div>2. EVERY FACT HAS A RECEIPT</div>
          </div>
        </div>
        <div className="absolute bottom-8 left-3 z-10 pointer-events-none hidden sm:block border border-border/60 bg-black/60 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground space-y-1">
          <div className="text-amber/80">LEGEND</div>
          <div className="flex items-center gap-2"><span className="inline-block h-2 w-3 bg-amber/50 border border-amber" /> LIVE · SELECTABLE</div>
          <div className="flex items-center gap-2"><span className="inline-block h-2 w-3 bg-[#141a26] border border-border" /> OFFLINE · NOT LOADED</div>
          <div className="flex items-center gap-2"><span className="inline-block h-px w-3 bg-muted-foreground/50" /> STATE BORDER</div>
        </div>
        <div className="absolute bottom-2 left-3 right-3 z-10 pointer-events-none flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>ALBERS USA · US CENSUS TIGER 2020</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" /> FL LIVE
          </span>
        </div>
      </div>
    </>
  );
}

function ComingSoon({ state, onBack }: { state: string; onBack: () => void }) {
  return (
    <div className="border border-border bg-surface rounded-sm p-8 text-center">
      <BackBtn onBack={onBack} />
      <div className="mono-label text-amber mt-4">{state} // COMING SOON</div>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Only Florida is loaded right now. Other states will light up as their public records are ingested.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — Florida: pick your districts, see your representatives.           */
/* -------------------------------------------------------------------------- */

function FloridaFinder({ onBack }: { onBack: () => void }) {
  const [zipInput, setZipInput] = useState("");
  const [submittedZip, setSubmittedZip] = useState<string | null>(null);
  const [senate, setSenate] = useState("");
  const [house, setHouse] = useState("");
  const [usHouse, setUsHouse] = useState("");

  const indexQuery = useQuery({
    queryKey: ["rep-index"],
    queryFn: fetchRepresentativesIndex,
    enabled: supabaseConfigured,
    staleTime: 5 * 60_000,
  });
  const rows = indexQuery.data ?? [];

  const groups = useMemo(() => {
    const pick = (level: string, chamber: string) =>
      rows.filter((r) => r.level === level && r.chamber === chamber).sort((a, b) => distNum(a.district) - distNum(b.district));
    return {
      senate: pick("state", "upper"),
      house: pick("state", "lower"),
      usHouse: pick("federal", "lower"),
      usSenate: pick("federal", "upper"),
    };
  }, [rows]);

  const zipQuery = useQuery({
    queryKey: ["zip-districts", submittedZip],
    queryFn: () => fetchZipDistricts(submittedZip!),
    enabled: supabaseConfigured && !!submittedZip && /^\d{5}$/.test(submittedZip),
  });

  // Resolve a (type, district_id) to a seated official via the rep index.
  const repFor = (type: DistrictType, districtId: string) => {
    const m = TYPE_META[type];
    return rows.find((r) => r.level === m.level && r.chamber === m.chamber && r.district === districtId);
  };

  const submitZip = () => {
    if (/^\d{5}$/.test(zipInput.trim())) setSubmittedZip(zipInput.trim());
  };

  const zipRows = zipQuery.data ?? [];
  const zipFound = !!submittedZip && zipRows.length > 0;
  const zipNotFound = !!submittedZip && !zipQuery.isLoading && !zipQuery.isError && zipRows.length === 0;

  const manualResults: DistrictResult[] = [
    usHouse ? { type: "congressional" as const, district_id: usHouse } : null,
    senate ? { type: "senate" as const, district_id: senate } : null,
    house ? { type: "house" as const, district_id: house } : null,
  ].filter(Boolean) as DistrictResult[];

  return (
    <>
      <BackBtn onBack={onBack} />

      {/* ZIP entry — the primary path */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mono-label">Enter your ZIP</span>
          <div className="mt-1 flex items-center gap-2 border border-border bg-surface rounded-sm px-3 py-2 focus-within:border-amber">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
              onKeyDown={(e) => e.key === "Enter" && submitZip()}
              inputMode="numeric"
              placeholder="e.g. 32801"
              className="w-24 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/60"
            />
          </div>
        </label>
        <button
          onClick={submitZip}
          disabled={!/^\d{5}$/.test(zipInput)}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-2.5 rounded-sm bg-amber text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
        >
          Find my reps
        </button>
        {submittedZip && (
          <button onClick={() => setSubmittedZip(null)} className="mono-label text-muted-foreground hover:text-amber">
            ← different ZIP
          </button>
        )}
      </div>

      {/* Honesty note — real Census data, all overlapping districts, ZCTA caveat */}
      <div className="mt-3 border border-cyan/40 bg-cyan/5 rounded-sm p-3">
        <p className="text-sm text-foreground leading-snug">
          A ZIP can span several districts — we show <span className="text-cyan">all of them</span>, weighted
          by land-area overlap (U.S. Census data), and never guess a single one. Some PO-box/business ZIPs have
          no boundary and won't resolve — pick your district instead if so.
        </p>
      </div>

      {!supabaseConfigured ? (
        <div className="mt-4 border border-border bg-surface rounded-sm p-6">
          <div className="mono-label text-amber">SUPABASE // NOT_CONFIGURED</div>
        </div>
      ) : indexQuery.isError ? (
        <QueryFault message={(indexQuery.error as Error).message} />
      ) : zipFound ? (
        <ResultsPanel
          heading={`YOUR REPRESENTATIVES · ZIP ${submittedZip}`}
          districtResults={zipRows.map((r) => ({ type: r.district_type, district_id: r.district_id, weight: r.area_weight }))}
          senators={groups.usSenate}
          repFor={repFor}
        />
      ) : submittedZip && zipQuery.isLoading ? (
        <div className="mt-5 h-40 border border-border bg-surface rounded-sm animate-pulse" />
      ) : submittedZip && zipQuery.isError ? (
        <QueryFault message={(zipQuery.error as Error).message} />
      ) : (
        <>
          {zipNotFound && (
            <div className="mt-4 border border-amber/50 bg-amber/5 rounded-sm p-4">
              <div className="mono-label text-amber">ZIP {submittedZip} · NOT FOUND</div>
              <p className="mt-1 text-sm text-foreground">
                That ZIP has no district boundary in the Census crosswalk (often a PO-box or business-only ZIP).
                Pick your district below instead.
              </p>
            </div>
          )}

          {/* Manual district picker — fallback / when no ZIP entered */}
          <div className="mt-4">
            <div className="mono-label text-cyan mb-2">{zipNotFound ? "PICK YOUR DISTRICT INSTEAD" : "OR PICK YOUR DISTRICT"}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DistrictSelect label="State Senate District" value={senate} onChange={setSenate} options={groups.senate} render={(r) => `Dist ${r.district} — ${r.full_name}`} />
              <DistrictSelect label="State House District" value={house} onChange={setHouse} options={groups.house} render={(r) => `Dist ${r.district} — ${r.full_name}`} />
              <DistrictSelect label="U.S. House District" value={usHouse} onChange={setUsHouse} options={groups.usHouse} render={(r) => `${r.district} — ${r.full_name}`} valueKey={(r) => r.district ?? ""} />
            </div>
          </div>

          <ResultsPanel
            heading="YOUR REPRESENTATIVES"
            districtResults={manualResults}
            senators={groups.usSenate}
            repFor={repFor}
            emptyPrompt="Enter your ZIP above, or pick a district, to see your state and U.S. House reps."
          />
        </>
      )}
    </>
  );
}

/* Grouped results: U.S. Senate (always) + each district type ordered by weight. */
function ResultsPanel({
  heading, districtResults, senators, repFor, emptyPrompt,
}: {
  heading: string;
  districtResults: DistrictResult[];
  senators: RepIndexRow[];
  repFor: (type: DistrictType, districtId: string) => RepIndexRow | undefined;
  emptyPrompt?: string;
}) {
  return (
    <div className="mt-6">
      <div className="mono-label text-amber mb-3">{heading}</div>

      <div className="mono-label text-muted-foreground mb-2">U.S. SENATE · STATEWIDE (represents all of Florida)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {senators.map((r) => <RepCard key={r.ocd_person_id} rep={r} note="U.S. Senator" />)}
      </div>

      {TYPE_ORDER.map((type) => {
        const items = districtResults.filter((d) => d.type === type);
        if (items.length === 0) return null;
        return (
          <div key={type}>
            <div className="mono-label text-muted-foreground mt-5 mb-2">{TYPE_META[type].label.toUpperCase()}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((d, i) => {
                const rep = repFor(type, d.district_id);
                const note = weightNote(type, d.district_id, d.weight, i, items.length);
                return rep ? (
                  <RepCard key={`${type}-${d.district_id}`} rep={rep} note={note} />
                ) : (
                  <VacantCard key={`${type}-${d.district_id}`} note={note} type={type} />
                );
              })}
            </div>
          </div>
        );
      })}

      {emptyPrompt && districtResults.length === 0 && (
        <p className="mt-5 text-sm text-muted-foreground">{emptyPrompt}</p>
      )}
    </div>
  );
}

/* District resolves, but the seat has no current member. */
function VacantCard({ note, type }: { note: string; type: DistrictType }) {
  return (
    <div className="border border-dashed border-amber/50 bg-amber/5 rounded-sm p-4">
      <div className="mono-label text-cyan mb-2">{note}</div>
      <div className="mono-label text-amber">SEAT VACANT</div>
      <p className="mt-1 text-sm text-muted-foreground">{TYPE_META[type].label} · no current member for this district.</p>
    </div>
  );
}

function QueryFault({ message }: { message: string }) {
  return (
    <div className="mt-4 border border-status-red/50 bg-status-red/5 rounded-sm p-6">
      <div className="mono-label text-status-red">QUERY_FAULT</div>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">{message}</p>
    </div>
  );
}

function DistrictSelect({
  label, value, onChange, options, render, valueKey,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: RepIndexRow[];
  render: (r: RepIndexRow) => string;
  valueKey?: (r: RepIndexRow) => string;
}) {
  const keyOf = valueKey ?? ((r: RepIndexRow) => r.district ?? "");
  return (
    <label className="block">
      <span className="mono-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-border bg-surface rounded-sm px-3 py-2 text-sm text-foreground outline-none focus:border-amber font-mono"
      >
        <option value="">— select —</option>
        {options.map((r) => (
          <option key={r.ocd_person_id} value={keyOf(r)}>
            {render(r)}
          </option>
        ))}
      </select>
    </label>
  );
}

function RepCard({ rep, note }: { rep: RepIndexRow; note: string }) {
  const party = toPartyCode(rep.party);
  return (
    <Link
      to="/officials/$id"
      params={{ id: officialSlug(rep.ocd_person_id) }}
      className="group border border-border bg-surface hover:border-amber/60 rounded-sm p-4 transition block"
    >
      <div className="mono-label text-cyan mb-2">{note}</div>
      <div className="flex items-start gap-3">
        <OfficialAvatar official={{ name: rep.full_name, photoSeed: rep.ocd_person_id, party }} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate group-hover:text-amber">{rep.full_name}</span>
            <PartyDot party={party} />
          </div>
          <OfficeTag level={levelOf(rep.level)} text={rep.district ? `Dist ${rep.district}` : rep.office ?? "—"} />
          <div className="mt-1 text-xs text-muted-foreground">{rep.office ?? "—"}</div>
        </div>
        <span className="mono-label group-hover:text-amber shrink-0">OPEN →</span>
      </div>
    </Link>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="inline-flex items-center gap-1.5 mono-label text-muted-foreground hover:text-amber"
    >
      <ArrowLeft className="h-3 w-3" /> BACK TO MAP
    </button>
  );
}
