import { supabase } from "@/lib/supabase";

function requireSb() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export type ThreadRow = {
  id: string;
  scope: string;
  title: string;
  body: string;
  tags: string[];
  handle: string;
  score: number;
  comment_count: number;
  status: "published" | "held" | "blocked";
  hold_reason: string | null;
  created_at: string;
};

export type ReportedThreadRow = ThreadRow & {
  report_count: number;
  reasons: string[];
};

export type ReportReason = "spam" | "hate" | "harassment" | "misinformation" | "other";

export const THREAD_PAGE_SIZE = 20;

// Format scope slug for display
export function formatScope(scope: string): string {
  if (scope === "fl-statewide") return "Florida Statewide";
  const parts = scope.split(":");
  if (parts.length !== 3) return scope;
  const [level, jurisdiction, district] = parts;
  if (level === "federal") return `US Congress · ${district}`;
  if (level === "state") return `${jurisdiction} Legislature · District ${district}`;
  if (level === "local") return `${jurisdiction} · ${district}`;
  return scope;
}

export async function fetchDistinctScopes(): Promise<string[]> {
  const sb = requireSb();
  const { data, error } = await sb.from("district_scopes").select("scope").order("scope");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { scope: string }) => r.scope);
}

export async function fetchThreads({
  scope,
  tag,
  sort,
  page,
}: {
  scope?: string;
  tag?: string;
  sort: "hot" | "new";
  page: number;
}): Promise<{ rows: ThreadRow[]; total: number }> {
  const sb = requireSb();
  let q = sb.from("threads").select("*", { count: "exact" }).eq("status", "published");

  if (scope) q = q.eq("scope", scope);
  if (tag) q = q.contains("tags", [tag]);

  if (sort === "new") {
    q = q.order("created_at", { ascending: false });
  } else {
    q = q.order("score", { ascending: false }).order("created_at", { ascending: false });
  }

  const from = page * THREAD_PAGE_SIZE;
  const { data, count, error } = await q.range(from, from + THREAD_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as ThreadRow[], total: count ?? 0 };
}

// Bulk hydration for saved-threads / activity feed. Threads are world-readable
// (Public read published RLS), so a simple in(...) works; empty list short-
// circuits to avoid a pointless round-trip.
export async function fetchThreadsByIds(ids: string[]): Promise<ThreadRow[]> {
  if (ids.length === 0) return [];
  const sb = requireSb();
  const { data, error } = await sb
    .from("threads")
    .select("*")
    .in("id", ids)
    .eq("status", "published");
  if (error) throw new Error(error.message);
  return (data ?? []) as ThreadRow[];
}

export async function fetchThread(id: string): Promise<ThreadRow> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("threads")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .single();
  if (error) throw new Error(error.message);
  return data as ThreadRow;
}

export async function fetchMyVote(threadId: string): Promise<1 | -1 | null> {
  const sb = requireSb();
  const { data } = await sb
    .from("thread_votes")
    .select("direction")
    .eq("thread_id", threadId)
    .maybeSingle();
  return (data as { direction: 1 | -1 } | null)?.direction ?? null;
}

export async function submitVote(threadId: string, direction: 1 | -1): Promise<void> {
  const sb = requireSb();
  const { error } = await sb
    .from("thread_votes")
    .upsert({ thread_id: threadId, direction }, { onConflict: "thread_id,user_id" });
  if (error) throw new Error(error.message);
}

export async function removeVote(threadId: string): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("thread_votes").delete().eq("thread_id", threadId);
  if (error) throw new Error(error.message);
}

export async function createThread(
  scope: string,
  title: string,
  body: string,
  tags: string[],
  accessToken: string,
): Promise<ThreadRow> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-comment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action: "create_thread", scope, title, body, tags }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create thread.");
  if (data.status === "blocked") throw new Error("Thread was blocked by content filters.");
  return data.thread as ThreadRow;
}

export async function deleteThread(threadId: string): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("threads").delete().eq("id", threadId);
  if (error) throw new Error(error.message);
}

export async function submitThreadReport(threadId: string, reason: ReportReason): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("thread_reports").insert({ thread_id: threadId, reason });
  if (error) {
    if (error.code === "23505") throw new Error("You already reported this thread.");
    throw new Error(error.message);
  }
}

// ---- my activity -------------------------------------------------------------
// A thread lands in a user's activity feed if they authored, commented on, or
// voted on it. Each source has an owner-scoped index (threads_user_rate_idx,
// comments_user_activity_idx, thread_votes_user_idx) so the three per-source
// reads are cheap; we union them client-side and hydrate the resulting thread
// ids in one fetchThreadsByIds() call. Threads that were deleted or blocked
// after the fact naturally drop out of the join.

export type ActivityAction = "authored" | "commented" | "voted";
export type ActivityRow = ThreadRow & {
  actions: ActivityAction[];
  last_activity_at: string; // most recent timestamp that qualified this row
};

export async function fetchMyActivity(userId: string, limit = 25): Promise<ActivityRow[]> {
  const sb = requireSb();

  const [authored, commented, voted] = await Promise.all([
    sb
      .from("threads")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(limit),
    sb
      .from("comments")
      .select("parent_id, created_at")
      .eq("user_id", userId)
      .eq("parent_type", "thread")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(limit),
    sb
      .from("thread_votes")
      .select("thread_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (authored.error) throw new Error(authored.error.message);
  if (commented.error) throw new Error(commented.error.message);
  if (voted.error) throw new Error(voted.error.message);

  const agg = new Map<string, { actions: Set<ActivityAction>; last: string }>();
  const record = (id: string, action: ActivityAction, ts: string) => {
    const e = agg.get(id) ?? { actions: new Set<ActivityAction>(), last: ts };
    e.actions.add(action);
    if (ts > e.last) e.last = ts;
    agg.set(id, e);
  };
  for (const r of (authored.data ?? []) as { id: string; created_at: string }[]) {
    record(r.id, "authored", r.created_at);
  }
  for (const r of (commented.data ?? []) as {
    parent_id: string;
    created_at: string;
  }[]) {
    record(r.parent_id, "commented", r.created_at);
  }
  for (const r of (voted.data ?? []) as {
    thread_id: string;
    created_at: string;
  }[]) {
    record(r.thread_id, "voted", r.created_at);
  }

  if (agg.size === 0) return [];

  const rows = await fetchThreadsByIds([...agg.keys()]);
  return rows
    .map((t) => {
      const e = agg.get(t.id)!;
      return { ...t, actions: [...e.actions], last_activity_at: e.last };
    })
    .sort((a, b) => (a.last_activity_at < b.last_activity_at ? 1 : -1))
    .slice(0, limit);
}

// ---- mod queue ---------------------------------------------------------------

export async function fetchHeldThreads(): Promise<ThreadRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("threads")
    .select("*")
    .eq("status", "held")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ThreadRow[];
}

export async function fetchReportedThreads(): Promise<ReportedThreadRow[]> {
  const sb = requireSb();
  const { data: reports, error: repErr } = await sb
    .from("thread_reports")
    .select("thread_id, reason");
  if (repErr) throw new Error(repErr.message);
  if (!reports?.length) return [];

  const ids = [...new Set(reports.map((r: { thread_id: string }) => r.thread_id))];
  const { data: threads, error: tErr } = await sb
    .from("threads")
    .select("*")
    .in("id", ids)
    .neq("status", "blocked");
  if (tErr) throw new Error(tErr.message);

  const agg = new Map<string, { count: number; reasons: string[] }>();
  for (const r of reports as { thread_id: string; reason: string }[]) {
    const e = agg.get(r.thread_id) ?? { count: 0, reasons: [] };
    e.count++;
    if (!e.reasons.includes(r.reason)) e.reasons.push(r.reason);
    agg.set(r.thread_id, e);
  }

  return ((threads ?? []) as ThreadRow[])
    .map((t) => ({
      ...t,
      report_count: agg.get(t.id)?.count ?? 0,
      reasons: agg.get(t.id)?.reasons ?? [],
    }))
    .sort((a, b) => b.report_count - a.report_count);
}

export async function moderateThread(threadId: string, action: "approve" | "block"): Promise<void> {
  const sb = requireSb();
  const { error } = await sb
    .from("threads")
    .update({ status: action === "approve" ? "published" : "blocked" })
    .eq("id", threadId);
  if (error) throw new Error(error.message);
}
