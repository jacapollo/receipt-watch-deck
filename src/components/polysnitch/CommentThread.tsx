import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Flag, MessageSquare, Send, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchComments,
  deleteComment,
  submitReport,
  type CommentRow,
  type ReportReason,
  COMMENT_PAGE_SIZE,
} from "@/lib/comments";

const CONDUCT_RULES = [
  "Discuss the public record only — votes, filings, official statements.",
  "No harassment, slurs, or threats.",
  "No doxxing or information about private individuals.",
  "Source your claims. Specific accusations may be held for review.",
  "Links are not allowed. Cite sources by name instead.",
];

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "hate", label: "Hate speech" },
  { value: "harassment", label: "Harassment" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other", label: "Other" },
];

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

export function CommentThread({
  parentType,
  parentId,
}: {
  parentType: "official" | "bill" | "thread";
  parentId: string;
}) {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = ["comments", parentType, parentId] as const;

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitMsg, setSubmitMsg] = useState<"held" | "posted" | null>(null);
  const [conductOpen, setConductOpen] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportErr, setReportErr] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: [...key, page],
    queryFn: () => fetchComments(parentType, parentId, page),
    staleTime: 30_000,
  });
  const comments = query.data ?? [];
  const hasMore = comments.length === COMMENT_PAGE_SIZE;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    setSubmitting(true);
    setSubmitErr(null);
    setSubmitMsg(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          parent_type: parentType,
          parent_id: parentId,
          body: text.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to post comment.");
      if (data.comment?.status === "held") {
        setSubmitMsg("held");
      } else {
        setSubmitMsg("posted");
        // Reload page 0 so the new comment appears
        setPage(0);
        qc.invalidateQueries({ queryKey: key });
      }
      setText("");
    } catch (err) {
      setSubmitErr((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReport() {
    if (!reportingId) return;
    setReportErr(null);
    try {
      await submitReport(reportingId, reportReason);
      setReportDone(true);
      setTimeout(() => {
        setReportingId(null);
        setReportDone(false);
      }, 1800);
    } catch (err) {
      setReportErr((err as Error).message);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment(commentId);
      qc.setQueryData([...key, page], (old: CommentRow[] | undefined) =>
        (old ?? []).filter((c) => c.id !== commentId),
      );
    } catch {
      // silent — comment might already be gone
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-3.5 w-3.5 text-amber" />
        <span className="mono-label text-amber">DISCUSSION</span>
        {comments.length > 0 && (
          <span className="mono-label text-muted-foreground">
            {comments.length} COMMENT{comments.length !== 1 ? "S" : ""}
          </span>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mb-5">
        <div className="border border-border bg-surface rounded-sm focus-within:border-amber/60 transition">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSubmitErr(null);
              setSubmitMsg(null);
            }}
            placeholder={user ? "Discuss the public record…" : "Sign in to join the discussion"}
            disabled={submitting || !user}
            maxLength={1000}
            rows={3}
            className="w-full bg-transparent p-3 text-sm resize-none outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-border">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {text.length}/1000
              </span>
              <button
                type="button"
                onClick={() => setConductOpen((v) => !v)}
                className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-amber transition"
              >
                <ShieldCheck className="h-3 w-3" /> Conduct
              </button>
            </div>
            {user ? (
              <button
                type="submit"
                disabled={submitting || !text.trim()}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 border border-amber text-amber rounded-sm hover:bg-amber hover:text-primary-foreground transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-3 w-3" />
                {submitting ? "Posting…" : "Post"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate({ to: "/login" })}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 border border-border text-muted-foreground rounded-sm hover:border-amber hover:text-amber transition"
              >
                Sign in to post
              </button>
            )}
          </div>
        </div>
        {submitErr && <p className="mt-1.5 font-mono text-[11px] text-status-red">{submitErr}</p>}
        {submitMsg === "held" && (
          <p className="mt-1.5 font-mono text-[11px] text-status-yellow">
            Your comment is held for review and will appear once approved.
          </p>
        )}
        {submitMsg === "posted" && (
          <p className="mt-1.5 font-mono text-[11px] text-status-green">Comment posted.</p>
        )}
      </form>

      {/* Code of conduct */}
      {conductOpen && (
        <div className="mb-5 border border-border/60 bg-surface-2/50 rounded-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="mono-label text-amber">CODE OF CONDUCT</span>
            <button
              onClick={() => setConductOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ol className="space-y-1.5">
            {CONDUCT_RULES.map((rule, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground/80">
                <span className="font-mono text-amber text-xs mt-0.5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Comment list */}
      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-20 bg-surface animate-pulse rounded-sm border border-border"
            />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-6 text-center">
          <p className="mono-label text-muted-foreground">NO DISCUSSION YET · BE THE FIRST</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {comments.map((c) => (
              <CommentCard
                key={c.id}
                comment={c}
                isOwn={user?.id === c.user_id}
                onDelete={() => handleDelete(c.id)}
                onReport={() => {
                  setReportingId(c.id);
                  setReportReason("spam");
                  setReportErr(null);
                  setReportDone(false);
                }}
              />
            ))}
          </div>
          {(page > 0 || hasMore) && (
            <div className="mt-4 flex items-center justify-center gap-3">
              {page > 0 && (
                <button
                  onClick={() => setPage((p) => p - 1)}
                  className="font-mono text-[11px] uppercase tracking-widest px-3 py-2 border border-border rounded-sm hover:border-amber hover:text-amber transition"
                >
                  Newer
                </button>
              )}
              {hasMore && (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="font-mono text-[11px] uppercase tracking-widest px-3 py-2 border border-border rounded-sm hover:border-amber hover:text-amber transition"
                >
                  Older
                </button>
              )}
            </div>
          )}
        </>
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
            <div className="mono-label text-amber mb-3">REPORT COMMENT</div>
            {reportDone ? (
              <p className="text-sm text-status-green font-mono">Report submitted. Thank you.</p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {REPORT_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="report-reason"
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
    </div>
  );
}

function CommentCard({
  comment: c,
  isOwn,
  onDelete,
  onReport,
}: {
  comment: CommentRow;
  isOwn: boolean;
  onDelete: () => void;
  onReport: () => void;
}) {
  return (
    <article className="border border-border bg-surface rounded-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-amber font-semibold">@{c.handle}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {timeAgo(c.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwn && (
            <button
              onClick={onDelete}
              className="font-mono text-[11px] text-muted-foreground hover:text-status-red uppercase tracking-widest transition"
            >
              Delete
            </button>
          )}
          <button
            onClick={onReport}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-status-red uppercase tracking-widest transition"
          >
            <Flag className="h-2.5 w-2.5" /> Report
          </button>
        </div>
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words">
        {c.body}
      </p>
    </article>
  );
}
