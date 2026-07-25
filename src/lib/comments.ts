import { supabase } from "@/lib/supabase";

function requireSb() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export type CommentRow = {
  id: string;
  parent_type: "official" | "bill" | "thread";
  parent_id: string;
  user_id: string;
  handle: string;
  body: string;
  status: "published" | "held" | "blocked";
  hold_reason: string | null;
  created_at: string;
};

export const COMMENT_PAGE_SIZE = 20;

export async function fetchComments(
  parentType: "official" | "bill" | "thread",
  parentId: string,
  page = 0,
): Promise<CommentRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("comments")
    .select("id, parent_type, parent_id, user_id, handle, body, status, hold_reason, created_at")
    .eq("parent_type", parentType)
    .eq("parent_id", parentId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(page * COMMENT_PAGE_SIZE, (page + 1) * COMMENT_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as CommentRow[];
}

export async function deleteComment(commentId: string): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
}

export type ReportReason = "spam" | "hate" | "harassment" | "misinformation" | "other";

export async function submitReport(commentId: string, reason: ReportReason): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("comment_reports").insert({ comment_id: commentId, reason });
  if (error) {
    if (error.code === "23505") throw new Error("You've already reported this comment.");
    throw new Error(error.message);
  }
}

// ---- mod queue ---------------------------------------------------------------

export type ReportedCommentRow = CommentRow & {
  report_count: number;
  reasons: string[];
};

export async function fetchIsModerator(): Promise<boolean> {
  const sb = requireSb();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from("profiles").select("is_moderator").eq("id", user.id).single();
  return (data as { is_moderator: boolean } | null)?.is_moderator === true;
}

export async function fetchHeldComments(): Promise<CommentRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("comments")
    .select("*")
    .eq("status", "held")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CommentRow[];
}

export async function fetchReportedComments(): Promise<ReportedCommentRow[]> {
  const sb = requireSb();
  const { data: reports, error: repErr } = await sb
    .from("comment_reports")
    .select("comment_id, reason");
  if (repErr) throw new Error(repErr.message);
  if (!reports?.length) return [];

  const ids = [...new Set(reports.map((r) => r.comment_id as string))];
  const { data: comments, error: comErr } = await sb
    .from("comments")
    .select("*")
    .in("id", ids)
    .neq("status", "blocked");
  if (comErr) throw new Error(comErr.message);

  const agg = new Map<string, { count: number; reasons: string[] }>();
  for (const r of reports) {
    const e = agg.get(r.comment_id) ?? { count: 0, reasons: [] };
    e.count++;
    if (!e.reasons.includes(r.reason)) e.reasons.push(r.reason);
    agg.set(r.comment_id, e);
  }

  return ((comments ?? []) as CommentRow[])
    .map((c) => ({
      ...c,
      report_count: agg.get(c.id)?.count ?? 0,
      reasons: agg.get(c.id)?.reasons ?? [],
    }))
    .sort((a, b) => b.report_count - a.report_count);
}

export async function moderateComment(
  commentId: string,
  action: "approve" | "block",
): Promise<void> {
  const sb = requireSb();
  const { error } = await sb
    .from("comments")
    .update({ status: action === "approve" ? "published" : "blocked" })
    .eq("id", commentId);
  if (error) throw new Error(error.message);
}
