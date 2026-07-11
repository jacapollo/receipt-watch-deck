import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import {
  OfficialAvatar,
  OfficeTag,
  SectionHeader,
  BillStatusPill,
  SourceTag,
} from "@/components/polysnitch/Primitives";
import { TrackButton } from "@/components/polysnitch/TrackButton";
import { useAuth } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";
import {
  deriveBillStatus,
  hostOf,
  levelOf,
  officialSlug,
  toPartyCode,
} from "@/lib/records";
import {
  fetchMyProfile,
  fetchOfficialsByIds,
  fetchBillsByIds,
  updateMyHandle,
  useFollows,
  validateHandle,
  type ProfileRow,
} from "@/lib/follows";
import { LogIn, LogOut, Pencil, Check, X } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile · PolySnitch" },
      { name: "description", content: "Your anonymous handle and the officials and bills you track." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading, signOut } = useAuth();

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-4xl mx-auto">
        <SectionHeader eyebrow="USER // ANONYMOUS" title="Profile" />

        {!supabaseConfigured ? (
          <Panel>
            <div className="mono-label text-amber">SUPABASE // NOT_CONFIGURED</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Accounts need Supabase credentials in{" "}
              <span className="font-mono text-cyan">.env.local</span>.
            </p>
          </Panel>
        ) : loading ? (
          <div className="h-40 border border-border bg-surface rounded-sm animate-pulse" />
        ) : !user ? (
          <SignInPrompt />
        ) : (
          <SignedIn userId={user.id} onSignOut={() => signOut()} />
        )}

        <div className="mt-8 mono-label text-center pt-5 border-t border-border">
          PolySnitch tracks the public record of public officials only.
        </div>
      </div>
    </AppShell>
  );
}

function SignInPrompt() {
  return (
    <Panel>
      <div className="mono-label text-amber flex items-center gap-1.5">
        <LogIn className="h-3.5 w-3.5" /> NO ACTIVE SESSION
      </div>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        Sign in to keep a private, anonymous handle and track the officials and bills you care
        about. Public records stay readable without an account.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest px-3 py-2 rounded-sm bg-amber text-primary-foreground hover:brightness-110 transition"
        >
          <LogIn className="h-3.5 w-3.5" /> Sign in / create account
        </Link>
        <Link
          to="/feed"
          className="inline-flex items-center font-mono text-[11px] uppercase tracking-widest px-3 py-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:border-amber transition"
        >
          Browse the feed
        </Link>
      </div>
    </Panel>
  );
}

function SignedIn({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const profileQuery = useQuery({
    queryKey: ["my-profile", userId],
    queryFn: () => fetchMyProfile(userId),
    staleTime: 30_000,
  });

  const follows = useFollows();
  const officialIds = [...follows.officialIds];
  const billIds = [...follows.billIds];

  const officialsQuery = useQuery({
    queryKey: ["followed-officials", officialIds.sort().join(",")],
    queryFn: () => fetchOfficialsByIds(officialIds),
    enabled: !follows.loading,
  });
  const billsQuery = useQuery({
    queryKey: ["followed-bills", billIds.sort().join(",")],
    queryFn: () => fetchBillsByIds(billIds),
    enabled: !follows.loading,
  });

  const officials = officialsQuery.data ?? [];
  const bills = billsQuery.data ?? [];

  return (
    <>
      <IdentityCard userId={userId} profile={profileQuery.data ?? null} loading={profileQuery.isLoading} />

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Followed officials */}
        <Panel>
          <div className="mono-label text-amber mb-3">
            OFFICIALS FOLLOWED · {follows.officialIds.size}
          </div>
          {follows.loading || officialsQuery.isLoading ? (
            <ListSkeleton />
          ) : officials.length === 0 ? (
            <EmptyRow
              body="Not tracking any officials yet."
              to="/officials"
              cta="Find officials"
            />
          ) : (
            <ul className="space-y-1">
              {officials.map((o) => {
                const party = toPartyCode(o.party);
                return (
                  <li key={o.ocd_person_id} className="flex items-center gap-2">
                    <Link
                      to="/officials/$id"
                      params={{ id: officialSlug(o.ocd_person_id) }}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-sm hover:bg-surface-2 flex-1 min-w-0"
                    >
                      <OfficialAvatar
                        official={{ name: o.full_name, photoSeed: o.ocd_person_id, party }}
                        size={36}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{o.full_name}</div>
                        <OfficeTag
                          level={levelOf(o.level)}
                          text={o.district ? `Dist ${o.district}` : o.office ?? "—"}
                        />
                      </div>
                    </Link>
                    <TrackButton kind="official" id={o.ocd_person_id} size="sm" />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Followed bills */}
        <Panel>
          <div className="mono-label text-cyan mb-3">BILLS TRACKED · {follows.billIds.size}</div>
          {follows.loading || billsQuery.isLoading ? (
            <ListSkeleton />
          ) : bills.length === 0 ? (
            <EmptyRow body="Not tracking any bills yet." to="/bills" cta="Find bills" />
          ) : (
            <ul className="space-y-2">
              {bills.map((b) => (
                <li key={b.id} className="flex items-start gap-2">
                  <BillStatusPill status={deriveBillStatus(b)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">
                      <span className="font-mono text-cyan">{b.identifier}</span> — {b.title}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="mono-label">{(b.level ?? "state").toUpperCase()}</span>
                      {b.openstates_url && (
                        <SourceTag source={hostOf(b.openstates_url)} url={b.openstates_url} />
                      )}
                    </div>
                  </div>
                  <TrackButton kind="bill" id={b.id} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="mono-label text-status-green flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
          SESSION · ACTIVE
        </span>
        <button
          onClick={onSignOut}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest border border-border bg-surface px-3 py-2 rounded-sm text-muted-foreground hover:text-status-red hover:border-status-red transition"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </>
  );
}

function IdentityCard({
  userId,
  profile,
  loading,
}: {
  userId: string;
  profile: ProfileRow | null;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handle = profile?.handle ?? "";
  const initials = handle.slice(0, 2).toUpperCase() || "??";

  useEffect(() => {
    if (!editing) setDraft(handle);
  }, [handle, editing]);

  const mutation = useMutation({
    mutationFn: (next: string) => updateMyHandle(userId, next),
    onSuccess: (row) => {
      qc.setQueryData(["my-profile", userId], row);
      setEditing(false);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const save = () => {
    const v = draft.trim().toLowerCase();
    if (v === handle) {
      setEditing(false);
      return;
    }
    const problem = validateHandle(v);
    if (problem) {
      setError(problem);
      return;
    }
    mutation.mutate(v);
  };

  return (
    <Panel>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 items-center">
        <div className="h-14 w-14 grid place-items-center bg-surface-2 border border-border rounded-sm font-mono font-bold text-amber text-lg">
          {loading ? "··" : initials}
        </div>
        <div className="min-w-0">
          <div className="mono-label text-status-green flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
            ANON SESSION ACTIVE
          </div>

          {editing ? (
            <div className="mt-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg text-muted-foreground">@</span>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value.toLowerCase());
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save();
                    if (e.key === "Escape") {
                      setEditing(false);
                      setError(null);
                    }
                  }}
                  maxLength={20}
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-background border border-border rounded-sm px-2 py-1 text-sm font-mono outline-none focus:border-amber"
                  placeholder="citizen_handle"
                />
                <button
                  onClick={save}
                  disabled={mutation.isPending}
                  aria-label="Save handle"
                  className="p-1.5 border border-border rounded-sm text-status-green hover:border-status-green disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  aria-label="Cancel"
                  className="p-1.5 border border-border rounded-sm text-muted-foreground hover:text-status-red hover:border-status-red"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                {error ? (
                  <span className="text-status-red">{error}</span>
                ) : (
                  "3–20 chars · lowercase letters, numbers, underscores"
                )}
              </p>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-bold">
                @{loading ? "…" : handle || "unknown"}
              </span>
              <button
                onClick={() => setEditing(true)}
                disabled={loading}
                className="inline-flex items-center gap-1 mono-label hover:text-amber disabled:opacity-40"
              >
                <Pencil className="h-3 w-3" /> EDIT
              </button>
            </div>
          )}

          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Your handle is your only public identity here — no name, no email.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="border border-border bg-surface rounded-sm p-5">{children}</div>;
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-10 bg-surface-2 animate-pulse rounded-sm" />
      ))}
    </div>
  );
}

function EmptyRow({ body, to, cta }: { body: string; to: string; cta: string }) {
  return (
    <div className="border border-dashed border-border rounded-sm p-5 text-center">
      <p className="text-sm text-muted-foreground">{body}</p>
      <Link
        to={to}
        className="mt-2 inline-block font-mono text-[11px] uppercase tracking-widest text-amber hover:underline"
      >
        {cta} →
      </Link>
    </div>
  );
}
