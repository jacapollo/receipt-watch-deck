import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLUR_RE = /\b(nigger|nigga|faggot|fag|kike|spic|chink|gook|wetback|coon|tranny|dyke)\b/i;
const LINK_RE = /https?:\/\/|www\.\S/i;
const SPAM_PATTERNS = [
  /(.)\1{4,}/,
  /[A-Z\s]{20,}/,
  /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function autoBlocked(text: string): boolean {
  if (LINK_RE.test(text)) return true;
  if (SLUR_RE.test(text)) return true;
  return SPAM_PATTERNS.some((re) => re.test(text));
}

function isNewAccount(createdAt: string): boolean {
  return new Date(createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = ReturnType<typeof createClient<any>>;

async function getProfile(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("handle, created_at")
    .eq("id", userId)
    .single();
  return { profile: data as { handle: string; created_at: string } | null, profileErr: error };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (payload.action === "create_thread") {
    return handleCreateThread(user.id, admin, payload);
  }
  return handleSubmitComment(user.id, admin, payload);
});

async function handleCreateThread(
  userId: string,
  admin: AdminClient,
  payload: Record<string, unknown>,
) {
  const { profile, profileErr } = await getProfile(admin, userId);
  if (profileErr || !profile)
    return json({ error: "Profile not found. Complete sign-up first." }, 403);

  // Scope — validated against real district data
  const scope = typeof payload.scope === "string" ? payload.scope.trim() : "";
  if (!scope) return json({ error: "scope is required." }, 400);

  const { data: validScope } = await admin
    .from("district_scopes")
    .select("scope")
    .eq("scope", scope)
    .maybeSingle();
  if (!validScope) return json({ error: `Scope "${scope}" does not exist.` }, 400);

  // Title
  const title = (typeof payload.title === "string" ? payload.title : "").trim();
  if (!title) return json({ error: "Title cannot be empty." }, 400);
  if (title.length > 200) return json({ error: "Title must be 200 characters or fewer." }, 400);

  // Body
  const body = (typeof payload.body === "string" ? payload.body : "").trim();
  if (!body) return json({ error: "Body cannot be empty." }, 400);
  if (body.length > 5000) return json({ error: "Body must be 5,000 characters or fewer." }, 400);

  // Tags: normalize to lowercase, dedupe, cap at 4
  const tags = Array.isArray(payload.tags)
    ? [
        ...new Set(
          (payload.tags as unknown[]).map((t) => String(t).toLowerCase().trim()).filter(Boolean),
        ),
      ].slice(0, 4)
    : [];

  // Thread rate limit — separate from comment limit
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("threads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  const isNew = isNewAccount(profile.created_at);
  const limit = isNew ? 1 : 2;

  if ((count ?? 0) >= limit) {
    return json(
      {
        error: isNew
          ? "New accounts can post 1 thread per hour."
          : "You can post up to 2 threads per hour. Try again later.",
      },
      429,
    );
  }

  // Auto-block on title, body, or any tag (link + spam patterns apply to tags too)
  if (autoBlocked(title) || autoBlocked(body) || tags.some(autoBlocked))
    return json({ status: "blocked" });

  const { data: thread, error: insertErr } = await admin
    .from("threads")
    .insert({
      scope,
      title,
      body,
      tags,
      user_id: userId,
      handle: profile.handle,
      status: "published",
    })
    .select("id, scope, title, body, tags, handle, score, comment_count, created_at")
    .single();

  if (insertErr) return json({ error: insertErr.message }, 500);
  return json({ thread }, 201);
}

async function handleSubmitComment(
  userId: string,
  admin: AdminClient,
  payload: Record<string, unknown>,
) {
  const { parent_type, parent_id, body } = payload;

  if (!["official", "bill", "thread"].includes((parent_type as string) ?? ""))
    return json({ error: "Invalid parent_type" }, 400);
  if (!parent_id || typeof parent_id !== "string" || parent_id.length > 200)
    return json({ error: "Invalid parent_id" }, 400);

  const trimmed = (typeof body === "string" ? body : "").trim();
  if (!trimmed) return json({ error: "Comment cannot be empty." }, 400);
  if (trimmed.length > 1000)
    return json({ error: "Comments must be 1,000 characters or fewer." }, 400);

  const { profile, profileErr } = await getProfile(admin, userId);
  if (profileErr || !profile)
    return json({ error: "Profile not found. Complete sign-up first." }, 403);

  // Rate limit: 5/hr established, 2/hr new accounts
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  const isNew = isNewAccount(profile.created_at);
  const limit = isNew ? 2 : 5;

  if ((count ?? 0) >= limit) {
    return json(
      {
        error: isNew
          ? "New accounts are limited to 2 comments per hour."
          : "You can post up to 5 comments per hour. Try again later.",
      },
      429,
    );
  }

  if (autoBlocked(trimmed)) return json({ status: "blocked" });

  const { data: comment, error: insertErr } = await admin
    .from("comments")
    .insert({
      parent_type,
      parent_id,
      user_id: userId,
      handle: profile.handle,
      body: trimmed,
      status: "published",
    })
    .select("id, handle, body, status, created_at")
    .single();

  if (insertErr) return json({ error: insertErr.message }, 500);
  return json({ comment }, 201);
}
