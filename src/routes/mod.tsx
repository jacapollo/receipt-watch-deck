import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionHeader } from "@/components/polysnitch/Primitives";
import { useAuth } from "@/lib/auth";
import {
  fetchIsModerator,
  fetchHeldComments,
  fetchReportedComments,
  moderateComment,
  type CommentRow,
  type ReportedCommentRow,
} from "@/lib/comments";
import {
  fetchHeldThreads,
  fetchReportedThreads,
  moderateThread,
  formatScope,
  type ThreadRow,
  type ReportedThreadRow,
} from "@/lib/threads";
import { officialSlug } from "@/lib/records";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/mod")({
  head: () => ({ meta: [{ title: "Mod Queue · PolySnitch" }] }),
  component: ModPage,
});

type Tab = "held" | "reported" | "threads";

function ModPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("held");

  const modQuery = useQuery({
    queryKey: ["is-moderator", user?.id],
    queryFn: fetchIsModerator,
    enabled: !!user,
  });

  if (loading || modQuery.isLoading) {
    return (
      <AppShell>
        <div className="px-4 md:px-8 py-6 max-w-[900px] mx-auto">
          <div className="h-8 w-40 bg-surface-2 animate-pulse rounded-sm" />
        </div>
      </AppShell>
    );
  }

  if (!user || !modQuery.data) {
    return (
      <AppShell>
        <div className="px-4 md:px-8 py-16 max-w-[900px] mx-auto text-center">
          <ShieldAlert className="h-8 w-8 text-amber mx-auto mb-3" />
          <div className="mono-label text-amber">ERR_403 // ACCESS_DENIED</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is restricted to moderators.
          </p>
          <Link to="/" className="mt-4 inline-block mono-label text-amber hover:underline">
            ← Home
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[900px] mx-auto">
        <SectionHeader
          eyebrow="MODERATION // QUEUE"
          title="Review Queue"
          right={
            <span className="mono-label text-status-red flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-red animate-pulse" />
              MOD ACTIVE
            </span>
          }
        />

        <div className="mt-4 border-b border-border flex gap-1 mb-6">
          {(
            [
              { key: "held", label: "Held Comments" },
              { key: "reported", label: "Reported Comments" },
              { key: "threads", label: "Reported Threads" },
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest border-b-2 -mb-px transition ${
                tab === key
                  ? "border-amber text-amber"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "held" && <HeldQueue />}
        {tab === "reported" && <ReportedQueue />}
        {tab === "threads" && <ReportedThreadsQueue />}
      </div>
    </AppShell>
  );
}

function HeldQueue() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["mod-held"],
    queryFn: fetchHeldComments,
  });
  const comments = query.data ?? [];

  async function act(id: string, action: "approve" | "block") {
    await moderateComment(id, action);
    qc.setQueryData(["mod-held"], (old: CommentRow[] | undefined) =>
      (old ?? []).filter((c) => c.id !== id),
    );
  }

  if (query.isLoading) return <QueueSkeleton />;
  if (query.isError) return <QueueError message={(query.error as Error).message} />;
  if (comments.length === 0) return <QueueEmpty label="No comments held for review." />;

  return (
    <div className="space-y-4">
      {comments.map((c) => (
        <CommentModCard
          key={c.id}
          comment={c}
          badge={
            <span className="mono-label text-status-yellow">
              HELD · {c.hold_reason ?? "review"}
            </span>
          }
          actions={
            <>
              <ModAction label="Approve" tone="green" onClick={() => act(c.id, "approve")} />
              <ModAction label="Block" tone="red" onClick={() => act(c.id, "block")} />
            </>
          }
        />
      ))}
    </div>
  );
}

function ReportedQueue() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["mod-reported"],
    queryFn: fetchReportedComments,
  });
  const comments = query.data ?? [];

  async function act(id: string, action: "approve" | "block") {
    await moderateComment(id, action);
    qc.setQueryData(["mod-reported"], (old: ReportedCommentRow[] | undefined) =>
      (old ?? []).filter((c) => c.id !== id),
    );
  }

  if (query.isLoading) return <QueueSkeleton />;
  if (query.isError) return <QueueError message={(query.error as Error).message} />;
  if (comments.length === 0) return <QueueEmpty label="No reported comments." />;

  return (
    <div className="space-y-4">
      {comments.map((c) => (
        <CommentModCard
          key={c.id}
          comment={c}
          badge={
            <span className="mono-label text-status-red">
              {c.report_count} REPORT{c.report_count !== 1 ? "S" : ""} · {c.reasons.join(", ")}
            </span>
          }
          actions={
            <>
              <ModAction label="Keep" tone="green" onClick={() => act(c.id, "approve")} />
              <ModAction label="Block" tone="red" onClick={() => act(c.id, "block")} />
            </>
          }
        />
      ))}
    </div>
  );
}

function ReportedThreadsQueue() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["mod-reported-threads"],
    queryFn: fetchReportedThreads,
  });
  const threads = query.data ?? [];

  async function act(id: string, action: "approve" | "block") {
    await moderateThread(id, action);
    qc.setQueryData(["mod-reported-threads"], (old: ReportedThreadRow[] | undefined) =>
      (old ?? []).filter((t) => t.id !== id),
    );
  }

  if (query.isLoading) return <QueueSkeleton />;
  if (query.isError) return <QueueError message={(query.error as Error).message} />;
  if (threads.length === 0) return <QueueEmpty label="No reported threads." />;

  return (
    <div className="space-y-4">
      {threads.map((t) => (
        <ThreadModCard
          key={t.id}
          thread={t}
          badge={
            <span className="mono-label text-status-red">
              {t.report_count} REPORT{t.report_count !== 1 ? "S" : ""} · {t.reasons.join(", ")}
            </span>
          }
          actions={
            <>
              <ModAction label="Keep" tone="green" onClick={() => act(t.id, "approve")} />
              <ModAction label="Block" tone="red" onClick={() => act(t.id, "block")} />
            </>
          }
        />
      ))}
    </div>
  );
}

function CommentModCard({
  comment: c,
  badge,
  actions,
}: {
  comment: CommentRow | ReportedCommentRow;
  badge: React.ReactNode;
  actions: React.ReactNode;
}) {
  const parentHref =
    c.parent_type === "official"
      ? `/officials/${officialSlug(c.parent_id)}`
      : c.parent_type === "thread"
        ? `/discuss/${c.parent_id}`
        : `/bills`;

  const parentLabel =
    c.parent_type === "official" ? "OFFICIAL" : c.parent_type === "thread" ? "THREAD" : "BILL";

  return (
    <div className="border border-border bg-surface rounded-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div className="space-y-0.5">
          {badge}
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs text-amber">@{c.handle}</span>
            <span className="mono-label text-muted-foreground">
              {new Date(c.created_at).toLocaleString()}
            </span>
            <Link
              to={parentHref as "/officials/$id" | "/bills" | "/discuss/$id"}
              params={
                c.parent_type === "official"
                  ? { id: officialSlug(c.parent_id) }
                  : c.parent_type === "thread"
                    ? { id: c.parent_id }
                    : undefined
              }
              className="mono-label text-cyan hover:underline"
            >
              VIEW {parentLabel} →
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words border border-border/40 bg-surface-2/40 rounded-sm p-3">
        {c.body}
      </p>
    </div>
  );
}

function ThreadModCard({
  thread: t,
  badge,
  actions,
}: {
  thread: ReportedThreadRow;
  badge: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-surface rounded-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div className="space-y-0.5">
          {badge}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-mono text-xs text-amber">@{t.handle}</span>
            <span className="mono-label text-muted-foreground">
              {new Date(t.created_at).toLocaleString()}
            </span>
            <span className="mono-label text-cyan">{formatScope(t.scope)}</span>
            <Link
              to="/discuss/$id"
              params={{ id: t.id }}
              search={{ scope: undefined }}
              className="mono-label text-cyan hover:underline"
            >
              VIEW THREAD →
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="border border-border/40 bg-surface-2/40 rounded-sm p-3 space-y-1.5">
        <p className="text-sm font-bold text-foreground">{t.title}</p>
        <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-line break-words">
          {t.body}
        </p>
      </div>
    </div>
  );
}

function ModAction({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: "green" | "red";
  onClick: () => void;
}) {
  const cls =
    tone === "green"
      ? "border-status-green/60 text-status-green hover:bg-status-green/10"
      : "border-status-red/60 text-status-red hover:bg-status-red/10";
  return (
    <button
      onClick={onClick}
      className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 border rounded-sm transition ${cls}`}
    >
      {label}
    </button>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 bg-surface animate-pulse rounded-sm border border-border" />
      ))}
    </div>
  );
}

function QueueEmpty({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-border rounded-sm p-10 text-center">
      <p className="mono-label text-muted-foreground">{label}</p>
    </div>
  );
}

function QueueError({ message }: { message: string }) {
  return (
    <div className="border border-status-red/40 bg-status-red/5 rounded-sm p-5">
      <p className="mono-label text-status-red">QUERY_FAULT</p>
      <p className="font-mono text-xs text-muted-foreground mt-1">{message}</p>
    </div>
  );
}
