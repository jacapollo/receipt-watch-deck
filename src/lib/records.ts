// Shared Supabase data access for the real-data lenses (Votes, Officials, Bills).
// Read-only via the anon key + "Public read" RLS policy.
import { supabase } from "@/lib/supabase";
import type { Party, BillStatus } from "@/lib/mock-data";

// ---- row shapes -------------------------------------------------------------

export type OfficialRow = {
  ocd_person_id: string;
  full_name: string;
  party: string | null;
  office: string | null;
  chamber: string | null;
  level: string | null;
  state: string | null;
  district: string | null;
  photo_url: string | null;
  bio?: string | null;
  source?: SourceRef | null;
};

export type BillRow = {
  id: string;
  ocd_bill_id: string;
  identifier: string;
  title: string;
  official_summary: string | null;
  level: string | null;
  state: string | null;
  session: string | null;
  chamber: string | null;
  status: string | null;
  subjects: string[] | null;
  introduced_date: string | null;
  last_action_date: string | null;
  last_action_description: string | null;
  openstates_url: string | null;
  source: SourceRef | null;
};

export type VoteRow = {
  individual_vote_id: string;
  option: string;
  motion_text: string | null;
  vote_result: string | null;
  vote_date: string | null;
  chamber: string | null;
  source: SourceRef | null;
  officials: Pick<OfficialRow, "ocd_person_id" | "full_name" | "party" | "office" | "district"> | null;
  bills: Pick<BillRow, "id" | "identifier" | "title" | "openstates_url"> | null;
};

export type SponsorshipRow = {
  raw_name: string;
  classification: string | null;
  is_primary: boolean;
  ocd_person_id: string | null;
  sponsor_resolutions: {
    resolved_official_id: string | null;
    match_confidence: string;
  } | null;
};

// The official this sponsorship points to, if resolved with confidence.
export function sponsorOfficialId(s: SponsorshipRow): string | null {
  return s.ocd_person_id ?? s.sponsor_resolutions?.resolved_official_id ?? null;
}

export type SourceRef = { label?: string; url?: string };

// ---- money layer (campaign_finance / campaign_top_donors views) -------------

export type CampaignFinanceRow = {
  campaign_id: string;
  official_id: string;
  election_id: string;          // e.g. "20241105-GEN"
  fl_doe_account: number | null;
  office_as_filed: string | null;
  district_as_filed: string | null;
  party_as_filed: string | null;
  campaign_source: SourceRef | null;
  contribution_count: number;
  total: number;
  self_funded: number;
  outside: number;
};

export type TopDonorRow = {
  campaign_id: string;
  donor_name: string;
  is_self_funding: boolean;
  contribution_count: number;
  total: number;
  receipt_url: string | null;
};

// "20241105-GEN" -> "2024 General" · "20250610-S02" -> "2025 Special (Jun 10)"
export function electionLabel(electionId: string): string {
  const m = electionId.match(/^(\d{4})(\d{2})(\d{2})-(GEN|S\d+)$/);
  if (!m) return electionId;
  const [, y, mo, d, kind] = m;
  if (kind === "GEN") return `${y} General`;
  const month = new Date(Number(y), Number(mo) - 1, Number(d)).toLocaleString("en-US", { month: "short" });
  return `${y} Special (${month} ${Number(d)})`;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export const PAGE_SIZE = 25;

// ---- presentation helpers ---------------------------------------------------

export function toPartyCode(party?: string | null): Party {
  const p = (party || "").toLowerCase();
  if (p.startsWith("dem")) return "D";
  if (p.startsWith("rep")) return "R";
  return "I";
}

export function chamberLabel(chamber?: string | null): string {
  return chamber === "upper" ? "Senate" : chamber === "lower" ? "House" : "—";
}

export function levelOf(level?: string | null): "federal" | "state" | "local" {
  return level === "federal" || level === "local" ? level : "state";
}

// The Open States id is "ocd-person/<uuid>"; the slash breaks a single route
// segment, so URLs carry just the uuid and we re-add the prefix when querying.
export function officialSlug(ocdPersonId: string): string {
  return ocdPersonId.replace(/^ocd-person\//, "");
}
export function officialIdFromSlug(slug: string): string {
  return slug.startsWith("ocd-person/") ? slug : `ocd-person/${slug}`;
}

export function optionDisplay(option: string): { label: string; cls: string } {
  switch ((option || "").toLowerCase()) {
    case "yes":
      return { label: "YEA", cls: "text-status-green border-status-green/50 bg-status-green/10" };
    case "no":
      return { label: "NAY", cls: "text-status-red border-status-red/50 bg-status-red/10" };
    case "not voting":
      return { label: "N/V", cls: "text-muted-foreground border-border" };
    case "excused":
      return { label: "EXCUSED", cls: "text-status-yellow border-status-yellow/50 bg-status-yellow/10" };
    default:
      return { label: option.toUpperCase(), cls: "text-cyan border-cyan/50 bg-cyan/10" };
  }
}

export function hostOf(url?: string | null): string {
  if (!url) return "source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export function stampOf(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// The bills table has no `status` source column, so map the latest action /
// subjects onto the existing BillStatusPill categories.
export function deriveBillStatus(
  bill: Pick<BillRow, "last_action_description" | "subjects">,
): BillStatus {
  const d = (bill.last_action_description || "").toLowerCase();
  const subs = (bill.subjects || []).map((s) => s.toLowerCase());
  if (subs.some((s) => s.includes("veto")) || d.includes("veto")) return "Failed";
  if (d.includes("chapter") || d.includes("approved by governor") || d.includes("became law"))
    return "Signed";
  if (
    d.includes("died") ||
    d.includes("failed") ||
    d.includes("withdrawn") ||
    d.includes("indefinitely postponed") ||
    d.includes("laid on table")
  )
    return "Failed";
  if (d.includes("passed") || d.includes("enrolled") || d.includes("presented to governor"))
    return "Passed";
  if (d.includes("committee") || d.includes("referred") || d.includes("read")) return "In Committee";
  return "Introduced";
}

// ---- queries ----------------------------------------------------------------

function requireSb() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.",
    );
  }
  return supabase;
}

export async function fetchEstimatedCount(table: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase.from(table).select("*", { count: "estimated", head: true });
  return count ?? 0;
}

const OFFICIAL_COLS =
  "ocd_person_id, full_name, party, office, chamber, level, state, district, photo_url";

export async function fetchOfficials(args: {
  page: number;
  level: string;
  search: string;
  pageSize?: number;
}): Promise<{ rows: OfficialRow[]; total: number }> {
  const sb = requireSb();
  const size = args.pageSize ?? 30;
  const from = args.page * size;
  let q = sb
    .from("officials")
    .select(OFFICIAL_COLS, { count: "exact" })
    .order("family_name", { ascending: true })
    .range(from, from + size - 1);

  if (args.level !== "all") q = q.eq("level", args.level);

  const s = args.search.trim().replace(/[^a-zA-Z0-9 ]/g, "");
  if (s) {
    if (/^\d+$/.test(s)) q = q.eq("district", s);
    else q = q.ilike("full_name", `%${s}%`);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as OfficialRow[], total: count ?? 0 };
}

export async function fetchOfficialBySlug(slug: string): Promise<OfficialRow | null> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("officials")
    .select(`${OFFICIAL_COLS}, bio, source`)
    .eq("ocd_person_id", officialIdFromSlug(slug))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as OfficialRow) ?? null;
}

async function countVotes(officialId: string, option?: string): Promise<number> {
  const sb = requireSb();
  let q = sb.from("votes").select("individual_vote_id", { count: "exact", head: true }).eq("official_id", officialId);
  if (option) q = q.eq("option", option);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function latestVoteDate(officialId: string): Promise<string | null> {
  const sb = requireSb();
  const { data } = await sb
    .from("votes")
    .select("vote_date")
    .eq("official_id", officialId)
    .order("vote_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.vote_date as string | undefined) ?? null;
}

export async function fetchOfficialVoteStats(officialId: string): Promise<{
  total: number;
  yes: number;
  no: number;
  lastVote: string | null;
}> {
  const [total, yes, no, lastVote] = await Promise.all([
    countVotes(officialId),
    countVotes(officialId, "yes"),
    countVotes(officialId, "no"),
    latestVoteDate(officialId),
  ]);
  return { total, yes, no, lastVote };
}

export async function fetchOfficialVotes(
  officialId: string,
  page: number,
): Promise<VoteRow[]> {
  const sb = requireSb();
  const from = page * PAGE_SIZE;
  const { data, error } = await sb
    .from("votes")
    .select(
      "individual_vote_id, option, motion_text, vote_result, vote_date, chamber, source, bills(id, identifier, title, openstates_url)",
    )
    .eq("official_id", officialId)
    .order("vote_date", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as VoteRow[];
}

const BILL_COLS =
  "id, ocd_bill_id, identifier, title, official_summary, level, state, session, chamber, status, subjects, introduced_date, last_action_date, last_action_description, openstates_url, source";

export async function fetchBills(args: {
  page: number;
  level: string;
  search: string;
  pageSize?: number;
}): Promise<{ rows: BillRow[]; total: number }> {
  const sb = requireSb();
  const size = args.pageSize ?? 20;
  const from = args.page * size;
  let q = sb
    .from("bills")
    .select(BILL_COLS, { count: "exact" })
    .order("last_action_date", { ascending: false, nullsFirst: false })
    .range(from, from + size - 1);

  if (args.level !== "all") q = q.eq("level", args.level);

  const s = args.search.trim().replace(/[^a-zA-Z0-9 ]/g, "");
  if (s) q = q.or(`identifier.ilike.*${s}*,title.ilike.*${s}*`);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as BillRow[], total: count ?? 0 };
}

export async function fetchBillSponsors(billId: string): Promise<SponsorshipRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("sponsorships")
    .select(
      "raw_name, classification, is_primary, ocd_person_id, sponsor_resolutions(resolved_official_id, match_confidence)",
    )
    .eq("bill_id", billId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SponsorshipRow[];
}

// All finance rows for one official, newest cycle first.
export async function fetchOfficialFinance(officialId: string): Promise<CampaignFinanceRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("campaign_finance")
    .select("*")
    .eq("official_id", officialId)
    .order("election_id", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignFinanceRow[];
}

export const DONOR_PAGE_SIZE = 10;

// Outside donors for one campaign, biggest first, paginated.
export async function fetchCampaignDonors(campaignId: string, page: number): Promise<TopDonorRow[]> {
  const sb = requireSb();
  const from = page * DONOR_PAGE_SIZE;
  const { data, error } = await sb
    .from("campaign_top_donors")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_self_funding", false)
    .order("total", { ascending: false })
    .range(from, from + DONOR_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as TopDonorRow[];
}

// Every campaign's totals (264 rows) — the Money lens aggregates client-side.
// NOTE: do not FK-embed officials here; view embeds time out. Join in JS.
export async function fetchAllCampaignFinance(): Promise<CampaignFinanceRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("campaign_finance")
    .select(
      "campaign_id, official_id, election_id, fl_doe_account, party_as_filed, office_as_filed, district_as_filed, contribution_count, total, self_funded, outside",
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignFinanceRow[];
}

export type ZipDistrictRow = {
  district_type: "congressional" | "senate" | "house";
  district_id: string;
  area_weight: number;
};

// ZCTA(ZIP) -> all overlapping districts, biggest overlap first. Empty array
// means the ZIP has no ZCTA crosswalk row (PO-box/point ZIP) -> "not found".
export async function fetchZipDistricts(zip: string): Promise<ZipDistrictRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("zip_districts")
    .select("district_type, district_id, area_weight")
    .eq("zcta", zip)
    .order("area_weight", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ZipDistrictRow[];
}

export type RepIndexRow = {
  ocd_person_id: string;
  full_name: string;
  party: string | null;
  office: string | null;
  level: string | null;
  chamber: string | null;
  district: string | null;
};

// Full current membership (state + federal) for the Map "find your reps" flow.
// Excludes chamber-less backfill rows (not current seat-holders). ~188 rows.
export async function fetchRepresentativesIndex(): Promise<RepIndexRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("officials")
    .select("ocd_person_id, full_name, party, office, level, chamber, district")
    .not("chamber", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as RepIndexRow[];
}

// Minimal roster for client-side joins on the Money lens (161 rows).
export async function fetchOfficialsIndex(): Promise<
  Pick<OfficialRow, "ocd_person_id" | "full_name" | "party" | "chamber" | "district">[]
> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("officials")
    .select("ocd_person_id, full_name, party, chamber, district");
  if (error) throw new Error(error.message);
  return (data ?? []) as any;
}

// ---- Feed (merged reverse-chronological activity stream) --------------------
// Three real tables merged into one timeline. Votes (~70k) would drown out the
// far-fewer bills/contributions in a naive date-merge, so "All" pulls an EQUAL
// slice from each type per page and merges those by date — every page carries
// all three. Type filters page a single table deeply. Each item keeps its
// source_ref url receipt.

export type FeedVote = {
  kind: "vote";
  key: string;
  date: string | null;
  option: string;
  motion_text: string | null;
  official: Pick<OfficialRow, "ocd_person_id" | "full_name" | "party" | "office" | "district"> | null;
  bill: Pick<BillRow, "id" | "identifier" | "title" | "openstates_url"> | null;
  sourceUrl: string | null;
};

export type FeedBill = {
  kind: "bill";
  key: string;
  date: string | null;         // introduced_date (fallback last_action_date)
  identifier: string;
  title: string;
  level: string | null;
  session: string | null;
  status: BillStatus;
  detailUrl: string | null;    // the bill's canonical detail page (Open States)
  sourceUrl: string | null;
};

export type FeedContribution = {
  kind: "contribution";
  key: string;
  date: string | null;
  donor_name: string;
  amount: number;
  is_self_funding: boolean;
  officialId: string | null;   // recipient — resolve name via the roster index
  sourceUrl: string | null;
};

export type FeedItem = FeedVote | FeedBill | FeedContribution;
export type FeedFilter = "all" | "vote" | "bill" | "contribution";

// Equal slice per type on the merged "All" view; deeper page when one type is
// isolated by a filter.
const FEED_PER_TYPE = 8;
const FEED_SINGLE = 25;

async function fetchFeedVotes(page: number, size: number): Promise<FeedVote[]> {
  const sb = requireSb();
  const from = page * size;
  const { data, error } = await sb
    .from("votes")
    .select(
      "individual_vote_id, option, motion_text, vote_date, source, " +
        "officials(ocd_person_id, full_name, party, office, district), " +
        "bills(id, identifier, title, openstates_url)",
    )
    .order("vote_date", { ascending: false, nullsFirst: false })
    .range(from, from + size - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map((v: any) => ({
    kind: "vote",
    key: `vote:${v.individual_vote_id}`,
    date: v.vote_date,
    option: v.option,
    motion_text: v.motion_text,
    official: v.officials,
    bill: v.bills,
    sourceUrl: v.source?.url ?? null,
  }));
}

async function fetchFeedBills(page: number, size: number): Promise<FeedBill[]> {
  const sb = requireSb();
  const from = page * size;
  const { data, error } = await sb
    .from("bills")
    .select(
      "id, identifier, title, level, session, subjects, last_action_description, introduced_date, last_action_date, openstates_url, source",
    )
    .order("introduced_date", { ascending: false, nullsFirst: false })
    .range(from, from + size - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map((b: any) => ({
    kind: "bill",
    key: `bill:${b.id}`,
    date: b.introduced_date ?? b.last_action_date,
    identifier: b.identifier,
    title: b.title,
    level: b.level,
    session: b.session,
    status: deriveBillStatus(b),
    detailUrl: b.openstates_url ?? b.source?.url ?? null,
    sourceUrl: b.source?.url ?? b.openstates_url ?? null,
  }));
}

async function fetchFeedContributions(page: number, size: number): Promise<FeedContribution[]> {
  const sb = requireSb();
  const from = page * size;
  const { data, error } = await sb
    .from("contributions")
    .select("id, donor_name, amount, contribution_date, is_self_funding, source, campaigns(official_id)")
    .order("contribution_date", { ascending: false, nullsFirst: false })
    .range(from, from + size - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map((c: any) => ({
    kind: "contribution",
    key: `contrib:${c.id}`,
    date: c.contribution_date,
    donor_name: c.donor_name,
    amount: Number(c.amount),
    is_self_funding: c.is_self_funding,
    officialId: c.campaigns?.official_id ?? null,
    sourceUrl: c.source?.url ?? null,
  }));
}

export async function fetchFeed(
  filter: FeedFilter,
  page: number,
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  if (filter === "vote") {
    const items = await fetchFeedVotes(page, FEED_SINGLE);
    return { items, hasMore: items.length === FEED_SINGLE };
  }
  if (filter === "bill") {
    const items = await fetchFeedBills(page, FEED_SINGLE);
    return { items, hasMore: items.length === FEED_SINGLE };
  }
  if (filter === "contribution") {
    const items = await fetchFeedContributions(page, FEED_SINGLE);
    return { items, hasMore: items.length === FEED_SINGLE };
  }
  // "all": equal slice from each type (each newest-first), then ROUND-ROBIN
  // interleave them. A pure date-sort clusters into monotype runs when one
  // type's dates bunch up (e.g. a campaign's filing batch) — this guarantees a
  // vote, a bill, and a donation sit side by side while each column stays in
  // date order. Every page carries all three types.
  const [votes, bills, contribs] = await Promise.all([
    fetchFeedVotes(page, FEED_PER_TYPE),
    fetchFeedBills(page, FEED_PER_TYPE),
    fetchFeedContributions(page, FEED_PER_TYPE),
  ]);
  const items: FeedItem[] = [];
  const max = Math.max(votes.length, bills.length, contribs.length);
  for (let i = 0; i < max; i++) {
    if (votes[i]) items.push(votes[i]);
    if (bills[i]) items.push(bills[i]);
    if (contribs[i]) items.push(contribs[i]);
  }
  // more to show while ANY type still returned a full slice
  const hasMore =
    votes.length === FEED_PER_TYPE ||
    bills.length === FEED_PER_TYPE ||
    contribs.length === FEED_PER_TYPE;
  return { items, hasMore };
}

// "3d ago" / "8mo ago" — relative stamp for the feed. Data can be a year+ old;
// that's honest, not stale-looking.
export function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const units: [number, string][] = [
    [31536000, "y"],
    [2592000, "mo"],
    [604800, "w"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [s, label] of units) if (secs >= s) return `${Math.floor(secs / s)}${label} ago`;
  return "just now";
}

export async function fetchBillVotes(billId: string): Promise<VoteRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("votes")
    .select(
      "individual_vote_id, option, motion_text, vote_result, vote_date, chamber, source, officials(ocd_person_id, full_name, party, office, district)",
    )
    .eq("bill_id", billId)
    .order("vote_date", { ascending: false })
    .limit(120);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as VoteRow[];
}
