-- ============================================================
-- 001_twogether_schema.sql
-- Extends existing Pocket Map schema for the Twogether app
-- Run against: staging first, then production
-- ============================================================

-- ── couples ──────────────────────────────────────────────────
create table if not exists couples (
  id          uuid primary key default gen_random_uuid(),
  user_a_id   uuid not null references users(id),
  user_b_id   uuid references users(id),
  invite_code text not null unique,
  paired_at   timestamptz,
  status      text not null default 'pending'
                check (status in ('pending', 'active', 'disconnected')),
  created_at  timestamptz not null default now()
);

create index if not exists couples_invite_code_idx on couples(invite_code);

-- ── users: extend existing table ─────────────────────────────
alter table users
  add column if not exists email         text,
  add column if not exists apple_user_id text,
  add column if not exists display_name  text,
  add column if not exists avatar_url    text,
  add column if not exists couple_id     uuid references couples(id);

-- ── places: extend existing table ────────────────────────────
alter table places
  add column if not exists couple_id        uuid references couples(id),
  add column if not exists is_spontaneous   boolean not null default false,
  add column if not exists visit_count      int     not null default 0,
  add column if not exists bloom_level      int     not null default 0 check (bloom_level between 0 and 5),
  add column if not exists first_visited_at timestamptz,
  add column if not exists last_visited_at  timestamptz;

create index if not exists places_couple_id_idx on places(couple_id);

-- ── moments ───────────────────────────────────────────────────
create table if not exists moments (
  id                 uuid primary key default gen_random_uuid(),
  place_id           uuid not null references places(id),
  user_id            uuid not null references users(id),
  couple_id          uuid not null references couples(id),
  image_url          text not null,
  thumbnail_url      text,
  lat                float8,
  lng                float8,
  taken_at           timestamptz not null default now(),
  ai_caption         text,
  ai_tags            text[],
  pair_id            uuid,
  companion_present  boolean not null default true,
  created_at         timestamptz not null default now()
);

create index if not exists moments_place_id_idx  on moments(place_id);
create index if not exists moments_couple_id_idx on moments(couple_id);

-- ── gifts ─────────────────────────────────────────────────────
create table if not exists gifts (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references users(id),
  receiver_id   uuid not null references users(id),
  place_id      uuid not null references places(id),
  content_type  text not null check (content_type in ('voice', 'photo', 'text')),
  content_url   text,
  content_text  text,
  created_at    timestamptz not null default now(),
  unlocked_at   timestamptz
);

create index if not exists gifts_receiver_id_idx on gifts(receiver_id);
create index if not exists gifts_place_id_idx    on gifts(place_id);

-- ── visits ────────────────────────────────────────────────────
create table if not exists visits (
  id               uuid primary key default gen_random_uuid(),
  place_id         uuid not null references places(id),
  user_id          uuid not null references users(id),
  couple_id        uuid not null references couples(id),
  visited_at       timestamptz not null default now(),
  duration_minutes int
);

create index if not exists visits_place_id_idx  on visits(place_id);
create index if not exists visits_couple_id_idx on visits(couple_id);

-- ── Row Level Security ────────────────────────────────────────

alter table couples enable row level security;
alter table moments  enable row level security;
alter table gifts    enable row level security;
alter table visits   enable row level security;

-- Users can only see their own couple
create policy "couples: members only" on couples
  for all using (
    auth.uid() = user_a_id or auth.uid() = user_b_id
  );

-- Users can only see places belonging to their couple
create policy "places: couple members only" on places
  for all using (
    couple_id in (
      select id from couples
      where auth.uid() = user_a_id or auth.uid() = user_b_id
    )
  );

-- Users can only see moments from their couple
create policy "moments: couple members only" on moments
  for all using (
    couple_id in (
      select id from couples
      where auth.uid() = user_a_id or auth.uid() = user_b_id
    )
  );

-- Gifts: sender can write, receiver can read after unlock
create policy "gifts: sender or receiver" on gifts
  for all using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

-- Visits: couple members only
create policy "visits: couple members only" on visits
  for all using (
    couple_id in (
      select id from couples
      where auth.uid() = user_a_id or auth.uid() = user_b_id
    )
  );

-- ── bloom_level update function ───────────────────────────────
-- Called after each new moment or visit to recalculate bloom
create or replace function update_bloom_level(p_place_id uuid)
returns void language plpgsql as $$
declare
  v_visit_count  int;
  v_photo_count  int;
  v_both_visited boolean;
  v_time_span    int;
  v_has_pair     boolean;
  v_bloom        int;
begin
  select visit_count into v_visit_count from places where id = p_place_id;

  select count(*) into v_photo_count from moments where place_id = p_place_id;

  select count(distinct user_id) >= 2 into v_both_visited
  from visits where place_id = p_place_id;

  select coalesce(
    extract(day from max(visited_at) - min(visited_at))::int, 0
  ) into v_time_span
  from visits where place_id = p_place_id;

  select exists(
    select 1 from moments where place_id = p_place_id and pair_id is not null
  ) into v_has_pair;

  -- Bloom formula (tunable)
  v_bloom := 0;
  if v_visit_count >= 1 then v_bloom := 1; end if;
  if v_both_visited or v_visit_count >= 3 then v_bloom := 2; end if;
  if v_visit_count >= 3 and v_photo_count >= 5 then v_bloom := 3; end if;
  if v_time_span >= 30 and v_has_pair then v_bloom := 4; end if;
  if v_photo_count >= 50 and v_visit_count >= 10 then v_bloom := 5; end if;

  update places
  set bloom_level      = v_bloom,
      last_visited_at  = now()
  where id = p_place_id;
end;
$$;
