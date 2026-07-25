import {
  createFileRoute,
  Link,
  useNavigate,
  Outlet,
  useChildMatches,
} from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionHeader } from "@/components/polysnitch/Primitives";
import { SaveButton } from "@/components/polysnitch/SaveButton";
import { useAuth } from "@/lib/auth";
import {
  fetchThreads,
  fetchDistinctScopes,
  createThread,
  submitVote,
  removeVote,
  submitThreadReport,
  formatScope,
  THREAD_PAGE_SIZE,
  type ThreadRow,
  type ReportReason,
} from "@/lib/threads";
import { supabaseConfigured } from "@/lib/supabase";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  ShieldAlert,
  Flag,
} from "lucide-react";

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "hate", label: "Hate speech" },
  { value: "harassment", label: "Harassment" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other", label: "Other" },
];

export const Route = createFileRoute("/discuss")({
  validateSearch: (search: Record<string, unknown>) => ({
    scope: typeof search.scope === "string" ? search.scope : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Discuss · PolySnitch" },
      { name: "description", content: "District-scoped discussion of the public record." },
    ],
  }),
  component: DiscussPage,
});

function DiscussPage() {
  const childMatches = useChildMatches();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { scope: searchScope } = Route.useSearch();

  const [scope, setScope] = useState<string>(searchScope ?? "");
  const [tag, setTag] = useState<string>("");
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [page, setPage] = useState(0);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportErr, setReportErr] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);

  const scopesQuery = useQuery({
    queryKey: ["district-scopes"],
    queryFn: fetchDistinctScopes,
    enabled: supabaseConfigured,
    staleTime: 5 * 60_000,
  });

  const threadsQuery = useQuery({
    queryKey: ["threads", scope, tag, sort, page],
    queryFn: () => fetchThreads({ scope: scope || undefined, tag: tag || undefined, sort, page }),
    enabled: supabaseConfigured,
    placeholderData: keepPreviousData,
  });

  const rows = threadsQuery.data?.rows ?? [];
  const total = threadsQuery.data?.total ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / THREAD_PAGE_SIZE) - 1);

  if (childMatches.length > 0) return <Outlet />;

  function reset(fn: () => void) {
    fn();
    setPage(0);
  }

  async function handleVote(threadId: string, dir: 1 | -1, currentScore: number) {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    // Optimistic update
    qc.setQueryData(["threads", scope, tag, sort, page], (old: typeof threadsQuery.data) => {
      if (!old) return old;
      return {
        ...old,
        rows: old.rows.map((t) => (t.id === threadId ? { ...t, score: currentScore + dir } : t)),
      };
    });
    try {
      await submitVote(threadId, dir);
    } catch {
      qc.invalidateQueries({ queryKey: ["threads"] });
    }
  }

  async function handleReport() {
    if (!reportingId) return;
    setReportErr(null);
    try {
      await submitThreadReport(reportingId, reportReason);
      setReportDone(true);
      setTimeout(() => {
        setReportingId(null);
        setReportDone(false);
      }, 1800);
    } catch (err) {
      setReportErr((err as Error).message);
    }
  }

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
        <SectionHeader
          eyebrow="COMMUNITY // DISTRICT"
          title="Discuss"
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGuidelinesOpen(true)}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest border border-border bg-surface px-2.5 py-1.5 rounded-sm text-muted-foreground hover:text-amber hover:border-amber transition"
              >
                <ShieldAlert className="h-3 w-3" />
                Guidelines
              </button>
              <button
                onClick={() => (user ? setNewThreadOpen(true) : navigate({ to: "/login" }))}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest border border-amber text-amber px-2.5 py-1.5 rounded-sm hover:bg-amber hover:text-primary-foreground transition"
              >
                <Plus className="h-3 w-3" />
                New Thread
              </button>
            </div>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <select
            value={scope}
            onChange={(e) => reset(() => setScope(e.target.value))}
            className="font-mono text-[11px] uppercase tracking-widest border border-border bg-surface rounded-sm px-3 py-1.5 text-foreground focus:border-amber outline-none"
          >
            <option value="">ALL SCOPES</option>
            {(scopesQuery.data ?? []).map((s) => (
              <option key={s} value={s}>
                {formatScope(s)}
              </option>
            ))}
          </select>

          <input
            value={tag}
            onChange={(e) => reset(() => setTag(e.target.value.toLowerCase()))}
            placeholder="Filter by tag…"
            className="font-mono text-[11px] uppercase tracking-widest border border-border bg-surface rounded-sm px-3 py-1.5 text-foreground placeholder:text-muted-foreground/60 focus:border-amber outline-none w-40"
          />

          <div className="flex items-center border border-border rounded-sm overflow-hidden">
            {(["hot", "new"] as const).map((s) => (
              <button
                key={s}
                onClick={() => reset(() => setSort(s))}
                className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 transition ${
                  sort === s
                    ? "bg-amber/10 text-amber"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <span className="mono-label text-muted-foreground ml-auto hidden md:inline">
            {supabaseConfigured ? `${total.toLocaleString()} THREADS` : "OFFLINE"}
          </span>
        </div>

        {!supabaseConfigured ? (
          <ConfigureNotice />
        ) : threadsQuery.isError ? (
          <ErrorNotice message={(threadsQuery.error as Error).message} />
        ) : threadsQuery.isLoading ? (
          <SkeletonList />
        ) : rows.length === 0 ? (
          <EmptyNotice />
        ) : (
          <>
            <div className="space-y-3">
              {rows.map((t) => (
                <ThreadCard
                  key={t.id}
                  thread={t}
                  isAuth={!!user}
                  onVote={(dir) => handleVote(t.id, dir, t.score)}
                  onReport={() => {
                    setReportingId(t.id);
                    setReportReason("spam");
                    setReportErr(null);
                    setReportDone(false);
                  }}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <PageBtn
                dir="prev"
                disabled={page === 0 || threadsQuery.isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                PAGE {page + 1} / {maxPage + 1}
              </span>
              <PageBtn
                dir="next"
                disabled={page >= maxPage || threadsQuery.isFetching}
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              />
            </div>
          </>
        )}
      </div>

      {/* Community guidelines modal */}
      {guidelinesOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setGuidelinesOpen(false)}
        >
          <div
            className="relative max-w-lg w-full border border-border bg-surface rounded-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setGuidelinesOpen(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-amber"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mono-label text-amber">COMMUNITY GUIDELINES</div>
            <h3 className="mt-1 text-xl font-bold">Stay on the record.</h3>
            <ol className="mt-4 space-y-2.5">
              {[
                "Discuss public actions of public officials only.",
                "No harassment, slurs, or threats — ever.",
                "No doxxing. No home addresses, family, or private individuals.",
                "Source your claims. Receipts over vibes.",
                "No links. Cite sources by name.",
                "Reports go to mods within 24h. Repeat offenders are removed.",
              ].map((g, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground/90">
                  <span className="font-mono text-amber text-xs mt-0.5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{g}</span>
                </li>
              ))}
            </ol>
            <button
              onClick={() => setGuidelinesOpen(false)}
              className="mt-5 w-full bg-amber text-primary-foreground font-bold uppercase tracking-wider text-xs py-2.5 rounded-sm hover:brightness-110 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* New thread modal */}
      {newThreadOpen && session && (
        <NewThreadModal
          scopes={scopesQuery.data ?? []}
          accessToken={session.access_token}
          onClose={() => setNewThreadOpen(false)}
          onCreated={(t) => {
            setNewThreadOpen(false);
            qc.invalidateQueries({ queryKey: ["threads"] });
            navigate({ to: "/discuss/$id", params: { id: t.id }, search: { scope: undefined } });
          }}
        />
      )}

      {/* Report modal */}
      {reportingId && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setReportingId(null)}
        >
          <div
            className="relative max-w-sm w-full border border-border bg-surface rounded-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setReportingId(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mono-label text-amber mb-3">REPORT THREAD</div>
            {reportDone ? (
              <p className="text-sm text-status-green font-mono">Report submitted. Thank you.</p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {REPORT_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="thread-report-reason"
                        value={r.value}
                        checked={reportReason === r.value}
                        onChange={() => setReportReason(r.value)}
                        className="accent-amber"
                      />
                      <span className="text-sm group-hover:text-amber transition">{r.label}</span>
                    </label>
                  ))}
                </div>
                {reportErr && <p className="text-xs text-status-red font-mono mb-2">{reportErr}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleReport}
                    className="flex-1 bg-status-red/90 text-white font-mono text-[11px] uppercase tracking-widest py-2 rounded-sm hover:bg-status-red transition"
                  >
                    Submit Report
                  </button>
                  <button
                    onClick={() => setReportingId(null)}
                    className="flex-1 border border-border font-mono text-[11px] uppercase tracking-widest py-2 rounded-sm hover:border-amber hover:text-amber transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ThreadCard({
  thread: t,
  isAuth,
  onVote,
  onReport,
}: {
  thread: ThreadRow;
  isAuth: boolean;
  onVote: (dir: 1 | -1) => void;
  onReport: () => void;
}) {
  return (
    <article className="border border-border bg-surface rounded-sm p-4 hover:border-amber/30 transition">
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-0.5 shrink-0 font-mono">
          <button
            onClick={() => onVote(1)}
            className="text-muted-foreground hover:text-amber transition"
            aria-label="Upvote"
          >
            <ArrowBigUp className="h-5 w-5" />
          </button>
          <span
            className={`text-sm font-bold tabular-nums ${t.score > 0 ? "text-amber" : t.score < 0 ? "text-status-red" : ""}`}
          >
            {t.score}
          </span>
          <button
            onClick={() => onVote(-1)}
            className="text-muted-foreground hover:text-status-red transition"
            aria-label="Downvote"
          >
            <ArrowBigDown className="h-5 w-5" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mono-label text-cyan">{formatScope(t.scope)}</span>
              {t.tags.map((tg) => (
                <span
                  key={tg}
                  className="font-mono text-[11px] uppercase tracking-widest text-cyan border border-cyan/40 px-1.5 py-0.5 rounded-[2px]"
                >
                  {tg}
                </span>
              ))}
            </div>
            <SaveButton threadId={t.id} size="sm" />
          </div>

          <Link
            to="/discuss/$id"
            params={{ id: t.id }}
            search={{ scope: undefined }}
            className="text-base md:text-lg font-bold hover:text-amber leading-tight block"
          >
            {t.title}
          </Link>

          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.body}</p>

          <div className="mt-2 flex items-center gap-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="text-amber/80">@{t.handle}</span>
            <span>{timeAgo(t.created_at)}</span>
            <Link
              to="/discuss/$id"
              params={{ id: t.id }}
              search={{ scope: undefined }}
              className="flex items-center gap-1 hover:text-foreground transition"
            >
              <MessageSquare className="h-3 w-3" />
              {t.comment_count} {t.comment_count === 1 ? "reply" : "replies"}
            </Link>
            {isAuth && (
              <button
                onClick={onReport}
                className="flex items-center gap-1 hover:text-status-red transition"
              >
                <Flag className="h-3 w-3" /> Report
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function NewThreadModal({
  scopes,
  accessToken,
  onClose,
  onCreated,
}: {
  scopes: string[];
  accessToken: string;
  onClose: () => void;
  onCreated: (t: ThreadRow) => void;
}) {
  const [scope, setScope] = useState(scopes[0] ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const tags = tagInput
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 4);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const thread = await createThread(scope, title, body, tags, accessToken);
      onCreated(thread);
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg border border-border bg-surface rounded-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-amber"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mono-label text-amber mb-4">NEW THREAD</div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mono-label text-muted-foreground block mb-1">SCOPE</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              required
              className="w-full font-mono text-[11px] uppercase tracking-widest border border-border bg-surface-2 rounded-sm px-3 py-2 text-foreground focus:border-amber outline-none"
            >
              {scopes.map((s) => (
                <option key={s} value={s}>
                  {formatScope(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mono-label text-muted-foreground block mb-1">TITLE</label>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="What's happening in your district?"
              className="w-full border border-border bg-surface-2 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber outline-none"
            />
            <div className="text-right font-mono text-[11px] text-muted-foreground mt-0.5">
              {title.length}/200
            </div>
          </div>

          <div>
            <label className="mono-label text-muted-foreground block mb-1">BODY</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              required
              rows={5}
              placeholder="Source your claims. Discuss the public record."
              className="w-full border border-border bg-surface-2 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber outline-none resize-none"
            />
            <div className="text-right font-mono text-[11px] text-muted-foreground mt-0.5">
              {body.length}/5000
            </div>
          </div>

          <div>
            <label className="mono-label text-muted-foreground block mb-1">
              TAGS <span className="text-muted-foreground/60">(comma-separated, max 4)</span>
            </label>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="zoning, budget, transit"
              className="w-full border border-border bg-surface-2 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber outline-none"
            />
            {tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[11px] uppercase tracking-widest text-cyan border border-cyan/40 px-1.5 py-0.5 rounded-[2px]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {err && <p className="font-mono text-[11px] text-status-red">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim() || !scope}
              className="flex-1 bg-amber text-primary-foreground font-bold uppercase tracking-wider text-xs py-2.5 rounded-sm hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Posting…" : "Post Thread"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border font-mono text-[11px] uppercase tracking-widest py-2.5 rounded-sm hover:border-amber hover:text-amber transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PageBtn({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-2 border border-border rounded-sm transition hover:border-amber hover:text-amber disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
    >
      {dir === "prev" && <Icon className="h-3.5 w-3.5" />}
      {dir === "prev" ? "Prev" : "Next"}
      {dir === "next" && <Icon className="h-3.5 w-3.5" />}
    </button>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 4, 5].map((i) => (
        <div key={i} className="border border-border bg-surface rounded-sm p-4">
          <div className="flex gap-3">
            <div className="w-5 flex flex-col items-center gap-1">
              <div className="h-5 w-5 bg-surface-2 animate-pulse rounded" />
              <div className="h-4 w-4 bg-surface-2 animate-pulse rounded" />
              <div className="h-5 w-5 bg-surface-2 animate-pulse rounded" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/4 bg-surface-2 animate-pulse rounded-sm" />
              <div className="h-4 w-3/4 bg-surface-2 animate-pulse rounded-sm" />
              <div className="h-3 w-full bg-surface-2 animate-pulse rounded-sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyNotice() {
  return (
    <div className="border border-dashed border-border rounded-sm p-10 text-center">
      <div className="mono-label text-amber">NO_THREADS</div>
      <p className="mt-2 text-sm text-muted-foreground">Be the first to start a discussion.</p>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="border border-status-red/50 bg-status-red/5 rounded-sm p-6">
      <div className="mono-label text-status-red">QUERY_FAULT</div>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">{message}</p>
    </div>
  );
}

function ConfigureNotice() {
  return (
    <div className="border border-border bg-surface rounded-sm p-6">
      <div className="mono-label text-amber">SUPABASE // NOT_CONFIGURED</div>
      <p className="mt-2 text-sm text-foreground">
        Add your project credentials to <span className="font-mono text-cyan">.env.local</span> and
        restart the dev server.
      </p>
    </div>
  );
}
