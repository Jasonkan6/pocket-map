-- ============================================================
-- 001_twogether_schema.sql  (revised — additive only)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- LINE Bot continues to work unchanged after this migration.
-- ============================================================

-- ── couples ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS couples (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   uuid NOT NULL REFERENCES auth.users(id),
  user_b_id   uuid REFERENCES auth.users(id),
  invite_code text NOT NULL UNIQUE,
  paired_at   timestamptz,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'active', 'disconnected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS couples_invite_code_idx ON couples(invite_code);

-- ── users (Twogether profile table) ──────────────────────────
-- This is separate from auth.users; stores display info.
CREATE TABLE IF NOT EXISTS users (
  id           uuid PRIMARY KEY REFERENCES auth.users(id),
  email        text,
  display_name text,
  avatar_url   text,
  couple_id    uuid REFERENCES couples(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── places: extend existing table (additive, all nullable) ───
-- Existing columns left untouched: saved_by, status, note,
-- address, image_url, source_type, lat, lng, name, category, region.
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS couple_id    uuid REFERENCES couples(id),
  ADD COLUMN IF NOT EXISTS bloom_level  int  DEFAULT 0 CHECK (bloom_level BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS visited      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS visit_count  int  DEFAULT 0;

CREATE INDEX IF NOT EXISTS places_couple_id_idx ON places(couple_id);
CREATE INDEX IF NOT EXISTS places_saved_by_idx  ON places(saved_by);

-- Backfill visited from LINE Bot's status column
UPDATE places SET visited = (status = 'visited') WHERE status IS NOT NULL;

-- ── moments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id          uuid NOT NULL REFERENCES places(id),
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  couple_id         uuid REFERENCES couples(id),
  image_url         text NOT NULL,
  thumbnail_url     text,
  lat               float8,
  lng               float8,
  taken_at          timestamptz NOT NULL DEFAULT now(),
  ai_caption        text,
  ai_tags           text[],
  companion_present boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moments_place_id_idx ON moments(place_id);

-- ── RLS on new tables only (places left without RLS for LINE Bot compat) ──

ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "couples: members only" ON couples
  FOR ALL USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY IF NOT EXISTS "users: own profile" ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "moments: own or couple" ON moments
  FOR ALL USING (
    auth.uid() = user_id
    OR couple_id IN (
      SELECT id FROM couples WHERE auth.uid() = user_a_id OR auth.uid() = user_b_id
    )
  );
