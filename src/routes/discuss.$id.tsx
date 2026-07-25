import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CommentThread } from "@/components/polysnitch/CommentThread";
import { SaveButton } from "@/components/polysnitch/SaveButton";
import { useAuth } from "@/lib/auth";
import {
  fetchThread,
  fetchMyVote,
  submitVote,
  removeVote,
  deleteThread,
  formatScope,
} from "@/lib/threads";
import { ArrowLeft, ArrowBigUp, ArrowBigDown, Trash2 } from "lucide-react";

export const Route = createFileRoute("/discuss/$id")({
  head: () => ({
    meta: [{ title: "Thread · PolySnitch Discuss" }],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const threadQuery = useQuery({
    queryKey: ["thread", id],
    queryFn: () => fetchThread(id),
    retry: false,
  });

  const voteQuery = useQuery({
    queryKey: ["thread-vote", id],
    queryFn: () => fetchMyVote(id),
    enabled: !!user,
  });

  const [deleting, setDeleting] = useState(false);

  const thread = threadQuery.data;
  const myVote = voteQuery.data ?? null;

  async function handleVote(dir: 1 | -1) {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!thread) return;

    const isSameDir = myVote === dir;
    // Optimistic local update
    const newScore = isSameDir ? thread.score - dir : thread.score + dir - (myVote ?? 0);
    qc.setQueryData(["thread", id], { ...thread, score: newScore });
    voteQuery.refetch();

    try {
      if (isSameDir) {
        await removeVote(id);
      } else {
        await submitVote(id, dir);
      }
    } catch {
      qc.invalidateQueries({ queryKey: ["thread", id] });
    }
    voteQuery.refetch();
  }

  async function handleDelete() {
    if (!thread || deleting) return;
    if (!confirm("Delete this thread? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteThread(id);
      navigate({ to: "/discuss", search: { scope: undefined } });
    } catch (err) {
      alert((err as Error).message);
      setDeleting(false);
    }
  }

  if (threadQuery.isLoading) {
    return (
      <AppShell>
        <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto space-y-4">
          <div className="h-4 w-24 bg-surface-2 animate-pulse rounded-sm" />
          <div className="h-8 w-3/4 bg-surface-2 animate-pulse rounded-sm" />
          <div className="h-32 bg-surface-2 animate-pulse rounded-sm" />
        </div>
      </AppShell>
    );
  }

  if (threadQuery.isError || !thread) {
    return (
      <AppShell>
        <div className="px-4 md:px-8 py-16 max-w-3xl mx-auto text-center">
          <div className="mono-label text-status-red">THREAD_NOT_FOUND</div>
          <Link
            to="/discuss"
            search={{ scope: undefined }}
            className="mt-4 inline-block mono-label text-amber hover:underline"
          >
            ← Discuss
          </Link>
        </div>
      </AppShell>
    );
  }

  const isOwn = user?.id === (thread as { user_id?: string }).user_id;

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-3xl mx-auto">
        <Link
          to="/discuss"
          search={{ scope: undefined }}
          className="inline-flex items-center gap-1.5 mono-label text-muted-foreground hover:text-amber mb-5 transition"
        >
          <ArrowLeft className="h-3 w-3" /> DISCUSS
        </Link>

        <article className="border border-border bg-surface rounded-sm p-5 mb-6">
          <div className="flex gap-4">
            {/* Vote column */}
            <div className="flex flex-col items-center gap-0.5 shrink-0 font-mono">
              <button
                onClick={() => handleVote(1)}
                className={`transition ${myVote === 1 ? "text-amber" : "text-muted-foreground hover:text-amber"}`}
                aria-label="Upvote"
              >
                <ArrowBigUp className="h-6 w-6" />
              </button>
              <span
                className={`text-base font-bold tabular-nums ${thread.score > 0 ? "text-amber" : thread.score < 0 ? "text-status-red" : ""}`}
              >
                {thread.score}
              </span>
              <button
                onClick={() => handleVote(-1)}
                className={`transition ${myVote === -1 ? "text-status-red" : "text-muted-foreground hover:text-status-red"}`}
                aria-label="Downvote"
              >
                <ArrowBigDown className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="mono-label text-cyan">{formatScope(thread.scope)}</span>
                  {thread.tags.map((tg) => (
                    <span
                      key={tg}
                      className="font-mono text-[11px] uppercase tracking-widest text-cyan border border-cyan/40 px-1.5 py-0.5 rounded-[2px]"
                    >
                      {tg}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SaveButton threadId={id} size="sm" />
                  {isOwn && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-muted-foreground hover:text-status-red transition disabled:opacity-40"
                      aria-label="Delete thread"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <h1 className="text-xl md:text-2xl font-bold leading-tight mb-3">{thread.title}</h1>

              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words">
                {thread.body}
              </p>

              <div className="mt-4 flex items-center gap-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <span className="text-amber/80">@{thread.handle}</span>
                <span>{timeAgo(thread.created_at)}</span>
                <span>
                  {thread.comment_count} {thread.comment_count === 1 ? "reply" : "replies"}
                </span>
              </div>
            </div>
          </div>
        </article>

        <CommentThread parentType="thread" parentId={id} />
      </div>
    </AppShell>
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
