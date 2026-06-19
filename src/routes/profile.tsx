import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { OfficialAvatar, OfficeTag, SectionHeader, BillStatusPill } from "@/components/polysnitch/Primitives";
import { officials, bills } from "@/lib/mock-data";
import { Bell, MapPin, Shuffle, LogOut } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile · PolySnitch" },
      { name: "description", content: "Your anonymous handle, location, and tracked officials." },
    ],
  }),
  component: ProfilePage,
});

const followedIds = [
  "fed-sen-ca-holloway",
  "local-cc-sf-3-nguyen",
  "fed-rep-ca12-okafor",
];
const trackedBillIds = ["bill-sb-118", "bill-ord-58", "bill-hr-3010"];

function ProfilePage() {
  const [handle, setHandle] = useState("ward_3_lurker");
  const [location, setLocation] = useState("San Vicente, CA · CA-12");
  const [notifs, setNotifs] = useState({
    votes: true,
    funding: true,
    statements: false,
    events: false,
  });

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-4xl mx-auto">
        <SectionHeader eyebrow="USER // ANONYMOUS" title="Profile" />

        <div className="border border-border bg-surface rounded-sm p-5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 items-center">
            <div className="h-14 w-14 grid place-items-center bg-surface-2 border border-border rounded-sm font-mono font-bold text-amber">
              W3
            </div>
            <div className="min-w-0">
              <div className="mono-label text-status-green flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
                ANON SESSION ACTIVE
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-lg font-bold">@{handle}</span>
                <button
                  onClick={() =>
                    setHandle(
                      ["civic_owl_47", "filer_404", "the_minutes", "ledger_rat"][
                        Math.floor(Math.random() * 4)
                      ],
                    )
                  }
                  className="inline-flex items-center gap-1 mono-label hover:text-amber"
                >
                  <Shuffle className="h-3 w-3" /> ROTATE
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-border rounded-sm p-3">
              <div className="mono-label text-amber flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> YOUR AREA
              </div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-2 w-full bg-transparent outline-none text-sm font-mono"
              />
            </div>
            <div className="border border-border rounded-sm p-3">
              <div className="mono-label text-cyan">LOCAL DISTRICTS</div>
              <p className="mt-2 text-sm font-mono">CA-12 · AD-14 · SD-11 · SV-D3</p>
            </div>
          </div>
        </div>

        {/* Following */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border bg-surface rounded-sm p-4">
            <div className="mono-label text-amber mb-3">OFFICIALS FOLLOWED · {followedIds.length}</div>
            <ul className="space-y-2">
              {followedIds.map((id) => {
                const o = officials.find((x) => x.id === id);
                if (!o) return null;
                return (
                  <li key={id}>
                    <Link
                      to="/officials/$id"
                      params={{ id }}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-sm hover:bg-surface-2"
                    >
                      <OfficialAvatar official={o} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{o.name}</div>
                        <OfficeTag level={o.level} text={o.district} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border border-border bg-surface rounded-sm p-4">
            <div className="mono-label text-cyan mb-3">BILLS TRACKED · {trackedBillIds.length}</div>
            <ul className="space-y-2">
              {trackedBillIds.map((id) => {
                const b = bills.find((x) => x.id === id);
                if (!b) return null;
                return (
                  <li key={id} className="flex items-start gap-2">
                    <BillStatusPill status={b.status} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-snug">{b.title}</div>
                      <div className="mono-label">{b.level.toUpperCase()}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Notifications */}
        <div className="mt-6 border border-border bg-surface rounded-sm p-4">
          <div className="mono-label text-amber mb-3 flex items-center gap-1.5">
            <Bell className="h-3 w-3" /> NOTIFICATIONS
          </div>
          <ul className="divide-y divide-border">
            {(
              [
                ["votes", "New votes by officials I follow"],
                ["funding", "New funding filings"],
                ["statements", "Public statements"],
                ["events", "Scheduled public events"],
              ] as const
            ).map(([k, label]) => (
              <li key={k} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{label}</span>
                <button
                  onClick={() => setNotifs((p) => ({ ...p, [k]: !p[k] }))}
                  className={`relative w-10 h-5 rounded-full transition ${
                    notifs[k] ? "bg-amber" : "bg-surface-2 border border-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 bg-background rounded-full transition ${
                      notifs[k] ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="mono-label">SESSION · DEMO MODE</span>
          <button className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest border border-border bg-surface px-3 py-2 rounded-sm text-muted-foreground hover:text-status-red hover:border-status-red">
            <LogOut className="h-3 w-3" />
            End session
          </button>
        </div>

        <div className="mt-8 mono-label text-center pt-5 border-t border-border">
          PolySnitch tracks the public record of public officials only.
        </div>
      </div>
    </AppShell>
  );
}
