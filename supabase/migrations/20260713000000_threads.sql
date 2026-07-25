-- Phase 4: Forum threads

-- district_scopes view — derives valid thread scopes from real officials data.
-- Format: level:jurisdiction:district  (e.g. "federal:US:FL-1", "state:FL:1")
-- Plus a hardcoded statewide scope for Florida.
CREATE OR REPLACE VIEW public.district_scopes AS
SELECT DISTINCT
  r.level || ':' || r.jurisdiction || ':' || r.district AS scope,
  r.level,
  r.jurisdiction,
  r.district
FROM public.official_roles r
WHERE r.level IS NOT NULL AND r.jurisdiction IS NOT NULL AND r.district IS NOT NULL
UNION ALL
SELECT 'fl-statewide', 'state', 'FL', NULL;

GRANT SELECT ON public.district_scopes TO anon, authenticated;

-- threads -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threads (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope         text        NOT NULL,
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body          text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  tags          text[]      NOT NULL DEFAULT '{}',
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle        text        NOT NULL,
  score         integer     NOT NULL DEFAULT 0,
  comment_count integer     NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'published'
                            CHECK (status IN ('published', 'held', 'blocked')),
  hold_reason   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- thread votes (composite PK is the dedup guard)
CREATE TABLE IF NOT EXISTS public.thread_votes (
  thread_id  uuid     NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id    uuid     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction  smallint NOT NULL CHECK (direction IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

-- thread reports
CREATE TABLE IF NOT EXISTS public.thread_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  reporter_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text        NOT NULL CHECK (reason IN ('spam','hate','harassment','misinformation','other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, reporter_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS threads_scope_idx      ON public.threads(scope, status, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS threads_user_rate_idx  ON public.threads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS thread_votes_thread_idx ON public.thread_votes(thread_id);
CREATE INDEX IF NOT EXISTS thread_reports_idx     ON public.thread_reports(thread_id);

-- Score trigger: recomputes threads.score whenever a vote is inserted/updated/deleted
CREATE OR REPLACE FUNCTION public.update_thread_score() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid;
BEGIN
  target_id := COALESCE(NEW.thread_id, OLD.thread_id);
  UPDATE public.threads
  SET score = (
    SELECT COALESCE(SUM(direction), 0)
    FROM public.thread_votes
    WHERE thread_id = target_id
  )
  WHERE id = target_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS thread_vote_score ON public.thread_votes;
CREATE TRIGGER thread_vote_score
  AFTER INSERT OR UPDATE OR DELETE ON public.thread_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_thread_score();

-- comment_count trigger: keeps threads.comment_count in sync with comments table
CREATE OR REPLACE FUNCTION public.sync_thread_comment_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_type = 'thread' THEN
    UPDATE public.threads
    SET comment_count = comment_count + 1
    WHERE id = NEW.parent_id::uuid;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_type = 'thread' THEN
    UPDATE public.threads
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.parent_id::uuid;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS thread_comment_count ON public.comments;
CREATE TRIGGER thread_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_thread_comment_count();

-- Extend comments.parent_type to allow 'thread' replies
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_parent_type_check;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_parent_type_check
  CHECK (parent_type IN ('official', 'bill', 'thread'));

-- RLS -----------------------------------------------------------------------
ALTER TABLE public.threads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_votes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_reports ENABLE ROW LEVEL SECURITY;

-- threads: anyone reads published; mods read all; mods update status; authors delete own
CREATE POLICY "Public read published threads"
  ON public.threads FOR SELECT USING (status = 'published');

CREATE POLICY "Moderators read all threads"
  ON public.threads FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_moderator = true)
  );

CREATE POLICY "Moderators update thread status"
  ON public.threads FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_moderator = true)
  );

CREATE POLICY "Authors delete own published threads"
  ON public.threads FOR DELETE USING (user_id = auth.uid() AND status = 'published');

-- No INSERT policy — all inserts go through submit-comment edge function

-- thread_votes: authenticated users CRUD their own row; no public enumeration
CREATE POLICY "Authenticated users insert vote"
  ON public.thread_votes FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users update own vote"
  ON public.thread_votes FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Authenticated users delete own vote"
  ON public.thread_votes FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users see own votes"
  ON public.thread_votes FOR SELECT USING (user_id = auth.uid());

-- thread_reports
CREATE POLICY "Authenticated users report threads"
  ON public.thread_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Moderators read all thread reports"
  ON public.thread_reports FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_moderator = true)
  );

CREATE POLICY "Reporters see own thread reports"
  ON public.thread_reports FOR SELECT USING (reporter_id = auth.uid());
