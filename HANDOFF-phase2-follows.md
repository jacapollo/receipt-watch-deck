# Handoff — PolySnitch Phase 2: real Profile + follows wiring

Date: 2026-07-11. Frontend repo: `~/Documents/receipt-watch-deck`. Pipeline repo: `~/public-records-pipeline`.

## Goal (from the user)
On the working Phase-1 auth foundation:
1. **Profile page** (`/profile`) → the logged-in user's real account: show auto-generated `citizen_xxxx` handle with **edit** (updates `profiles.handle` + `display_name`, owner-only RLS, **no email exposed**); show followed officials + followed bills from `user_follows` (own rows only via `auth.uid()`); **logged out → prompt sign-in, not error**. Keep dark tactical design.
2. **Wire Track buttons** on `/officials/$id` and `/bills`: logged in → insert/delete `user_follows` row (owner-only RLS), button reflects real Following/Follow state; logged out → prompt sign-in (don't fail silently).
3. Everything still works logged-out (public reads untouched).
4. Final confirm: logged-in user can follow/unfollow an official + a bill, they appear on Profile, handle edit works, second user cannot see/affect the first user's follows. Give the URL to test.

## Status: ~90% done. One open bug blocks sign-off (dossier render). Data layer + RLS fully proven.

### Built / changed (all committed to working tree, NOT git-committed)
- **`src/lib/follows.ts`** (NEW) — data layer + `useFollows()` hook.
  - `fetchMyProfile`, `updateMyHandle` (keeps handle+display_name in sync; maps 23505 → "handle taken"), `validateHandle` (`^[a-z0-9_]{3,20}$`).
  - `fetchMyFollows` (returns `{officialIds:Set, billIds:Set}`, `.eq(user_id)` belt-and-suspenders), `fetchOfficialsByIds`, `fetchBillsByIds`.
  - `useFollows()` — react-query `["my-follows", userId]`, enabled only when signed in; optimistic toggle + invalidate; exposes `signedIn`, `loading`, `isFollowingOfficial/Bill`, `toggleOfficial/Bill`.
  - Insert helpers ignore 23505 (dup) so double-click is safe.
- **`src/components/polysnitch/TrackButton.tsx`** (NEW) — shared Track control. Logged out → `navigate({to:"/login"})`. Logged in → toggles via `useFollows`. Props `{kind:"official"|"bill", id, size?}`.
- **`src/routes/profile.tsx`** (REWRITTEN) — `ProfilePage` branches: not configured / loading / `!user` (SignInPrompt) / `SignedIn`. `SignedIn` shows `IdentityCard` (inline handle edit w/ validation, no email shown) + followed officials + followed bills (each with a `TrackButton` to untrack), sign-out. Empty states link to /officials, /bills.
- **`src/routes/bills.tsx`** (EDITED) — removed local mock `followed` Set + `toggleFollow`; each row now uses `<TrackButton kind="bill" id={b.id} size="sm" />`. Removed now-unused `Star` import.
- **`src/routes/officials.$id.tsx`** (EDITED) — added `import { TrackButton }` and one `<TrackButton kind="official" id={officialId} size="sm" />` in the case-file header (after the DIST tag).

### Verified GREEN
- **RLS / follow flow harness**: `~/public-records-pipeline/spikes/verify-follows-rls.ts` → **16/16 PASS**. Creates two confirmed users via service-role admin, then drives everything through the **anon client with each user's JWT** (exactly like the browser). Proves: auto-created `citizen_xxxx` profile; A follows official+bill; **B cannot see A's follows/profile, cannot delete A's follow (0 rows), cannot spoof-insert with A's user_id (denied), cannot rename A's handle (0 rows)**; A renames own handle; A unfollows. Cleans up both users. Run: `cd ~/public-records-pipeline && npx tsx spikes/verify-follows-rls.ts`.
  - NOTE: had to `npm install --no-save --cache <scratchpad>/npm-cache @supabase/supabase-js` in the pipeline (it lacked supabase-js; `~/.npm` perms were broken → used scratchpad cache).
- **Logged-out frontend** (headless, `scratchpad/pw/phase2-loggedout.mjs`): `/profile` shows **NO ACTIVE SESSION** prompt (not error) ✓; `/bills` renders **20 Track buttons**, clicking one logged-out routes to **/login** ✓; **zero page errors**.
- `npx tsc --noEmit` → only the **pre-existing** `records.ts:345 fetchBillSponsors` TS2352 error (not mine); all Phase-2 files clean.
- Routes `/ /profile /bills /officials` all 200.

### ⚠️ OPEN BUG (must resolve before sign-off)
**`/officials/$id` dossier does not render** — navigating to a dossier (both direct URL and clicking a roster card) shows the **officials LIST** ("ROSTER // SUBJECTS · 190 SUBJECTS") instead of the dossier. No `<h1>` (official name), **no console/page errors**, no ERR_500 boundary, so Track-button count is 0 there. Reproduced with `scratchpad/pw/dossier-click.mjs` and `dossier-check2.mjs` (known-good id `df1d6ab6-b2cd-4a6f-b7cc-aa5a63d8011f`, slug = the uuid). Persists after a **clean dev-server restart** (killed old pid, `npm run dev` fresh; log clean).

**Not yet determined: pre-existing vs. caused by my `TrackButton` import in `officials.$id.tsx`.** Next step — bisect:
1. Temporarily remove the `<TrackButton .../>` line + import from `officials.$id.tsx`, re-run `dossier-click.mjs`. If the dossier renders → `TrackButton` (likely `useFollows`/`useAuth`/`useNavigate` throwing/suspending during that route's SSR or render, while TanStack keeps the prior match mounted). If it still shows the list → **pre-existing routing/SSR issue unrelated to Phase 2** (report to user; don't rabbit-hole).
2. If TrackButton is the cause: check it renders safely when `useFollows` is disabled/loading and under SSR (no `window` at module scope — it's fine, but confirm `useNavigate` usage). Consider guarding, or rendering the button but deferring the hook.
3. The roster card is a correct `<Link to="/officials/$id" params={{id: officialSlug(...)}}>` (officials.tsx:124). `officialSlug` strips `ocd-person/`; loader `fetchOfficialBySlug` re-adds it (records.ts:132-137).

Once fixed: confirm the dossier shows the Track button and that clicking it logged-out routes to /login (mirror the bills check), then the logged-in follow/unfollow round-trip is already proven by the RLS harness + optimistic UI.

## Environment / how to run
- Dev server: `cd ~/Documents/receipt-watch-deck && npm run dev` → **http://localhost:8080** (port 8080). Currently running (pid ~45299), log at `scratchpad/vite.log`.
- **URL to give the user once the dossier bug is fixed:** http://localhost:8080/profile (logged-out prompt), plus /officials/<id> and /bills for Track.
- Headless: `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw/browsers node <script>.mjs`; scripts in `scratchpad/pw/` (`phase2-loggedout.mjs`, `dossier-click.mjs`, `dossier-check2.mjs`, `dump.mjs`).
- Scratchpad root: `/private/tmp/claude-501/-Users-jacksoncarpenter/f0c35750-040c-4ffc-872e-53f7c8aa2423/scratchpad`.

## Schema recap (already applied in Phase 1)
- `profiles(id uuid pk→auth.users, handle text unique CHECK ^[a-z0-9_]{3,20}$, display_name text 1..50, created_at, updated_at)`; trigger `handle_new_user` seeds random `citizen_xxxx`, display_name=handle. RLS: own read/insert/update `auth.uid()=id`.
- `user_follows(id uuid pk, user_id uuid→auth.users, official_id text→officials.ocd_person_id, bill_id uuid→bills.id, created_at, CHECK exactly one of official_id/bill_id)`. Partial unique indexes per (user, official) / (user, bill). RLS: own read/insert/delete (no update) `auth.uid()=user_id`.
- `official_id` is the **full** `ocd-person/<uuid>`; `bill_id` is `bills.id` (uuid).

## Guardrails (unchanged, keep)
- Anon/publishable key only in frontend; **never** service-role client-side; never `VITE_` prefix on service-role. Service-role stays in pipeline `.env`. RLS is the gate.
- "Flag-don't-guess / every fact has a receipt (source_ref)." Don't diverge from existing tactical design system (`--amber` is `#ffffff`, `mono-label`, primitives in `components/polysnitch/Primitives.tsx`).

## Not in scope for Phase 2 (do not start)
- Public-read subset of profiles for Discuss; notifications backend (old mock notifications were dropped from Profile); any Discuss route wiring.
