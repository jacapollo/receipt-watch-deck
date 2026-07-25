// User-owned data (Phase 2+): the logged-in user's profile, follows, and
// saved threads. Everything here runs through the anon/publishable client with
// the user's JWT attached, so owner-only RLS on `profiles`, `user_follows`, and
// `saved_threads` is the real gate — a user can only ever read or write their
// own rows. We still pass user_id / .eq(user_id) explicitly so the intent is
// clear and inserts satisfy the WITH CHECK policy.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

function requireSb() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

// ---- profile ----------------------------------------------------------------

export type ProfileRow = {
  id: string;
  handle: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

// Validate a candidate handle against the DB check constraint before we ever
// hit the network. Returns an error string or null.
export function validateHandle(raw: string): string | null {
  const h = raw.trim();
  if (h.length < 3 || h.length > 20) return "Handle must be 3–20 characters.";
  if (!HANDLE_RE.test(h)) return "Use only lowercase letters, numbers, and underscores.";
  return null;
}

export async function fetchMyProfile(userId: string): Promise<ProfileRow | null> {
  const sb = requireSb();
  const { data, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfileRow) ?? null;
}

// Rename: we keep handle and display_name in sync (the handle IS the identity).
// RLS UPDATE policy scopes this to the owner's own row.
export async function updateMyHandle(userId: string, handle: string): Promise<ProfileRow> {
  const sb = requireSb();
  const clean = handle.trim();
  const { data, error } = await sb
    .from("profiles")
    .update({ handle: clean, display_name: clean })
    .eq("id", userId)
    .select()
    .single();
  if (error) {
    // 23505 = unique_violation on handle
    if (error.code === "23505") throw new Error("That handle is already taken.");
    throw new Error(error.message);
  }
  return data as ProfileRow;
}

// ---- follows ----------------------------------------------------------------

export type MyFollows = { officialIds: Set<string>; billIds: Set<string> };
const EMPTY_FOLLOWS: MyFollows = { officialIds: new Set(), billIds: new Set() };

export async function fetchMyFollows(userId: string): Promise<MyFollows> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("user_follows")
    .select("official_id, bill_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const officialIds = new Set<string>();
  const billIds = new Set<string>();
  for (const r of data ?? []) {
    if (r.official_id) officialIds.add(r.official_id as string);
    if (r.bill_id) billIds.add(r.bill_id as string);
  }
  return { officialIds, billIds };
}

async function followOfficial(userId: string, officialId: string) {
  const sb = requireSb();
  const { error } = await sb
    .from("user_follows")
    .insert({ user_id: userId, official_id: officialId });
  if (error && error.code !== "23505") throw new Error(error.message); // ignore dup
}
async function unfollowOfficial(userId: string, officialId: string) {
  const sb = requireSb();
  const { error } = await sb
    .from("user_follows")
    .delete()
    .eq("user_id", userId)
    .eq("official_id", officialId);
  if (error) throw new Error(error.message);
}
async function followBill(userId: string, billId: string) {
  const sb = requireSb();
  const { error } = await sb.from("user_follows").insert({ user_id: userId, bill_id: billId });
  if (error && error.code !== "23505") throw new Error(error.message);
}
async function unfollowBill(userId: string, billId: string) {
  const sb = requireSb();
  const { error } = await sb
    .from("user_follows")
    .delete()
    .eq("user_id", userId)
    .eq("bill_id", billId);
  if (error) throw new Error(error.message);
}

// ---- detail hydration for the Profile page ----------------------------------
// officials/bills are world-readable ("Public read" RLS), so a simple `in(...)`
// works. Empty id lists short-circuit to avoid a pointless round-trip.

export type FollowedOfficial = {
  ocd_person_id: string;
  full_name: string;
  party: string | null;
  office: string | null;
  level: string | null;
  district: string | null;
};

export async function fetchOfficialsByIds(ids: string[]): Promise<FollowedOfficial[]> {
  if (ids.length === 0) return [];
  const sb = requireSb();
  const { data, error } = await sb
    .from("officials")
    .select("ocd_person_id, full_name, party, office, level, district")
    .in("ocd_person_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as FollowedOfficial[];
}

export type FollowedBill = {
  id: string;
  identifier: string;
  title: string;
  level: string | null;
  subjects: string[] | null;
  last_action_description: string | null;
  openstates_url: string | null;
};

export async function fetchBillsByIds(ids: string[]): Promise<FollowedBill[]> {
  if (ids.length === 0) return [];
  const sb = requireSb();
  const { data, error } = await sb
    .from("bills")
    .select("id, identifier, title, level, subjects, last_action_description, openstates_url")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as FollowedBill[];
}

// ---- the shared hook --------------------------------------------------------
// One source of truth for follow state across the app (Track buttons + Profile).
// Optimistic toggles keep the button snappy; a query invalidation reconciles with
// the server. When logged out, everything is inert and `signedIn` is false so the
// UI can prompt sign-in instead of firing a doomed write.

export function useFollows() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const key = ["my-follows", userId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchMyFollows(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const follows = query.data ?? EMPTY_FOLLOWS;

  function optimisticToggle(kind: "official" | "bill", id: string, next: boolean) {
    qc.setQueryData<MyFollows>(key, (old) => {
      const base = old ?? EMPTY_FOLLOWS;
      const officialIds = new Set(base.officialIds);
      const billIds = new Set(base.billIds);
      const set = kind === "official" ? officialIds : billIds;
      if (next) set.add(id);
      else set.delete(id);
      return { officialIds, billIds };
    });
  }

  const mutation = useMutation({
    mutationFn: async (v: { kind: "official" | "bill"; id: string; next: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      if (v.kind === "official") {
        if (v.next) await followOfficial(userId, v.id);
        else await unfollowOfficial(userId, v.id);
      } else {
        if (v.next) await followBill(userId, v.id);
        else await unfollowBill(userId, v.id);
      }
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MyFollows>(key);
      optimisticToggle(v.kind, v.id, v.next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      if (userId) qc.invalidateQueries({ queryKey: key });
    },
  });

  return useMemo(
    () => ({
      signedIn: !!userId,
      loading: query.isLoading && !!userId,
      officialIds: follows.officialIds,
      billIds: follows.billIds,
      isFollowingOfficial: (id: string) => follows.officialIds.has(id),
      isFollowingBill: (id: string) => follows.billIds.has(id),
      toggleOfficial: (id: string, next: boolean) =>
        mutation.mutate({ kind: "official", id, next }),
      toggleBill: (id: string, next: boolean) => mutation.mutate({ kind: "bill", id, next }),
    }),
    [userId, query.isLoading, follows, mutation],
  );
}

// ---- saved threads ----------------------------------------------------------
// Bookmark set that mirrors follows exactly: owner-scoped table, optimistic
// toggle, per-user query key. Threads themselves are world-readable, so
// hydration goes through fetchThreadsByIds() in @/lib/threads.

export type SavedThreads = { threadIds: Set<string> };
const EMPTY_SAVED: SavedThreads = { threadIds: new Set() };

export async function fetchMySavedThreads(userId: string): Promise<SavedThreads> {
  const sb = requireSb();
  const { data, error } = await sb.from("saved_threads").select("thread_id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const threadIds = new Set<string>();
  for (const r of data ?? []) if (r.thread_id) threadIds.add(r.thread_id as string);
  return { threadIds };
}

async function saveThread(userId: string, threadId: string) {
  const sb = requireSb();
  const { error } = await sb.from("saved_threads").insert({ user_id: userId, thread_id: threadId });
  if (error && error.code !== "23505") throw new Error(error.message); // ignore dup
}

async function unsaveThread(userId: string, threadId: string) {
  const sb = requireSb();
  const { error } = await sb
    .from("saved_threads")
    .delete()
    .eq("user_id", userId)
    .eq("thread_id", threadId);
  if (error) throw new Error(error.message);
}

export function useSavedThreads() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const key = ["my-saved-threads", userId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchMySavedThreads(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const saved = query.data ?? EMPTY_SAVED;

  function optimisticToggle(id: string, next: boolean) {
    qc.setQueryData<SavedThreads>(key, (old) => {
      const base = old ?? EMPTY_SAVED;
      const threadIds = new Set(base.threadIds);
      if (next) threadIds.add(id);
      else threadIds.delete(id);
      return { threadIds };
    });
  }

  const mutation = useMutation({
    mutationFn: async (v: { id: string; next: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      if (v.next) await saveThread(userId, v.id);
      else await unsaveThread(userId, v.id);
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SavedThreads>(key);
      optimisticToggle(v.id, v.next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      if (userId) qc.invalidateQueries({ queryKey: key });
    },
  });

  return useMemo(
    () => ({
      signedIn: !!userId,
      loading: query.isLoading && !!userId,
      threadIds: saved.threadIds,
      isSaved: (id: string) => saved.threadIds.has(id),
      toggle: (id: string, next: boolean) => mutation.mutate({ id, next }),
    }),
    [userId, query.isLoading, saved, mutation],
  );
}
