import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionHeader, ReportButton } from "@/components/polysnitch/Primitives";
import { getThread, formatTimeAgo, type Comment } from "@/lib/mock-data";
import { ArrowBigUp, ArrowBigDown, ArrowLeft, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/discuss/$id")({
  loader: ({ params }) => {
    const t = getThread(params.id);
    if (!t) throw notFound();
    return { thread: t };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.thread.title ?? "Thread"} · PolySnitch Discuss` },
      { name: "description", content: loaderData?.thread.body.slice(0, 150) },
    ],
  }),
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="p-8">Error: {error.message}</div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8">
        <Link to="/discuss" className="text-amber">← Back to Discuss</Link>
      </div>
    </AppShell>
  ),
  component: ThreadPage,
});

function ThreadPage() {
  const { thread } = Route.useLoaderData();
  const [reply, setReply] = useState("");

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-3xl mx-auto">
        <Link
          to="/discuss"
          className="inline-flex items-center gap-1.5 mono-label text-muted-foreground hover:text-amber mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> DISCUSS
        </Link>

        <SectionHeader eyebrow={`SCOPE · ${thread.scope}`} title={thread.title} />

        <article className="border border-border bg-surface rounded-sm p-5">
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-0.5 shrink-0 font-mono">
              <ArrowBigUp className="h-5 w-5 text-muted-foreground hover:text-amber cursor-pointer" />
              <span className="text-sm font-bold">{thread.upvotes - thread.downvotes}</span>
              <ArrowBigDown className="h-5 w-5 text-muted-foreground hover:text-status-red cursor-pointer" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {thread.tags.map((tg: string) => (
                  <span
                    key={tg}
                    className="font-mono text-[10px] uppercase tracking-widest text-cyan border border-cyan/40 px-1.5 py-0.5 rounded-[2px]"
                  >
                    {tg}
                  </span>
                ))}
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{thread.body}</p>
              <div className="mt-3 flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>@{thread.author}</span>
                <span>{formatTimeAgo(thread.createdAt)}</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {thread.comments.length} replies
                </span>
                <ReportButton />
              </div>
            </div>
          </div>
        </article>

        {/* Reply box */}
        <div className="mt-5 border border-border bg-surface rounded-sm p-4">
          <div className="mono-label text-amber mb-2">REPLY · ANONYMOUS</div>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add to the record. Source your claims."
            rows={3}
            className="w-full bg-surface-2 border border-border rounded-sm p-3 text-sm outline-none focus:border-amber resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="mono-label">POSTING AS @ward_3_lurker</span>
            <button
              onClick={() => setReply("")}
              className="bg-amber text-primary-foreground font-bold uppercase tracking-wider text-xs px-4 py-2 rounded-sm hover:brightness-110"
            >
              Post reply
            </button>
          </div>
        </div>

        {/* Comments */}
        <div className="mt-6">
          <div className="mono-label mb-3">{thread.comments.length} REPLIES</div>
          <ul className="space-y-3">
            {thread.comments.map((c: Comment) => (
              <CommentItem key={c.id} comment={c} depth={0} />
            ))}
            {thread.comments.length === 0 && (
              <li className="border border-dashed border-border rounded-sm p-6 text-center text-sm text-muted-foreground">
                Be the first to reply.
              </li>
            )}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function CommentItem({ comment, depth }: { comment: Comment; depth: number }) {
  return (
    <li
      className="border-l-2 pl-3"
      style={{
        borderColor: depth === 0 ? "var(--color-border)" : "var(--color-cyan)",
        marginLeft: depth * 12,
      }}
    >
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        <span className="text-foreground">@{comment.author}</span>
        <span>{formatTimeAgo(comment.createdAt)}</span>
        <span>▲ {comment.upvotes}</span>
        <ReportButton />
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed">{comment.body}</p>
      {comment.replies && comment.replies.length > 0 && (
        <ul className="mt-3 space-y-3">
          {comment.replies.map((r) => (
            <CommentItem key={r.id} comment={r} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
