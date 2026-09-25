-- IgniteX Topic Sprint — initial schema
-- Run via `supabase db push` or paste into the SQL editor in order.

create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists event_state (
  id int primary key check (id = 1),
  status text not null default 'not_started'
    check (status in ('not_started', 'running', 'closed')),
  brief_text text not null default '',
  display_started_at timestamptz,
  display_duration_seconds int,
  updated_at timestamptz not null default now()
);

insert into event_state (id, status, brief_text)
values (1, 'not_started', 'Claim a campus-innovation idea before another team beats you to it.')
on conflict (id) do nothing;

create table if not exists submissions (
  id bigint generated always as identity primary key,
  team_number int not null,
  team_name text not null,
  idea_title text not null,
  idea_summary text not null,
  normalized_idea_title text not null,
  status text not null default 'pending'
    check (status in ('pending', 'flagged', 'approved', 'rejected')),
  similar_to_id bigint references submissions (id),
  similarity_score real,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists submissions_unique_approved_title
  on submissions (normalized_idea_title)
  where status = 'approved';

create unique index if not exists submissions_unique_approved_team
  on submissions (team_number)
  where status = 'approved';

create index if not exists submissions_normalized_title_trgm
  on submissions using gin (normalized_idea_title gin_trgm_ops);

create index if not exists submissions_status_idx on submissions (status);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  submission_id bigint not null references submissions (id),
  previous_status text,
  new_status text,
  action text not null,
  reason text,
  actor text not null check (actor in ('system', 'organizer')),
  created_at timestamptz not null default now()
);

-- Admin sessions: minted by the admin-auth Edge Function after a correct
-- PIN check. organizer_* functions require a live, unexpired token here.
-- This keeps the admin role out of full Supabase Auth for a single-PIN MVP.
create table if not exists admin_sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table event_state enable row level security;
alter table submissions enable row level security;
alter table audit_log enable row level security;
alter table admin_sessions enable row level security;

-- event_state: public read-only. Writes only through organizer_set_event_state().
create policy event_state_public_select on event_state
  for select using (true);

-- submissions: public can see approved rows only. No public insert/update —
-- writes only through submit_idea() / organizer_set_status(), both
-- security definer, which bypass RLS internally.
create policy submissions_public_select_approved on submissions
  for select using (status = 'approved');

-- audit_log: no public policies at all -> no public access by default.

-- admin_sessions: no public policies -> not readable/writable by anon key.
-- Only the service-role key (used by the Edge Function) and security
-- definer functions can touch this table.

-- ─────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────

create or replace function normalize_title(raw text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(regexp_replace(lower(raw), '[^a-z0-9\s]', '', 'g'), '\s+', ' ', 'g'));
$$;

create or replace function check_admin_token(p_admin_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_admin_token is null then
    raise exception 'Missing admin token';
  end if;

  delete from admin_sessions where expires_at < now();

  if not exists (
    select 1 from admin_sessions
    where token = p_admin_token and expires_at > now()
  ) then
    raise exception 'Admin session expired or invalid — please log in again';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- submit_idea(): the only way a team can create a submission
-- ─────────────────────────────────────────────────────────────────────────

create or replace function submit_idea(
  p_team_number int,
  p_team_name text,
  p_idea_title text,
  p_idea_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_normalized text;
  v_new_id bigint;
  v_exact_match_id bigint;
  v_fuzzy_id bigint;
  v_fuzzy_score real;
  v_threshold real := 0.6;
begin
  if p_team_number is null or p_team_number <= 0 then
    raise exception 'Invalid team number';
  end if;
  if coalesce(trim(p_team_name), '') = '' then
    raise exception 'Team name is required';
  end if;
  if coalesce(trim(p_idea_title), '') = '' or coalesce(trim(p_idea_summary), '') = '' then
    raise exception 'Idea title and summary are required';
  end if;

  -- 1. Sprint must be running
  select status into v_status from event_state where id = 1;
  if v_status is distinct from 'running' then
    raise exception 'Submissions are closed right now';
  end if;

  -- 2. Team may not already have an approved idea
  if exists (
    select 1 from submissions
    where team_number = p_team_number and status = 'approved'
  ) then
    raise exception 'Your team already has an approved idea';
  end if;

  -- 3. Normalize
  v_normalized := normalize_title(p_idea_title);

  -- 4. Exact match against approved/pending/flagged -> if approved, auto-reject
  select id into v_exact_match_id
  from submissions
  where normalized_idea_title = v_normalized
    and status = 'approved'
  limit 1;

  if v_exact_match_id is not null then
    insert into submissions (
      team_number, team_name, idea_title, idea_summary,
      normalized_idea_title, status, similar_to_id, similarity_score
    ) values (
      p_team_number, p_team_name, trim(p_idea_title), trim(p_idea_summary),
      v_normalized, 'rejected', v_exact_match_id, 1.0
    ) returning id into v_new_id;

    insert into audit_log (submission_id, previous_status, new_status, action, reason, actor)
    values (v_new_id, null, 'rejected', 'auto_reject_duplicate', 'Exact title match with an approved idea', 'system');

    return jsonb_build_object('status', 'rejected', 'id', v_new_id);
  end if;

  -- 5. Fuzzy match against any non-rejected title
  select id, similarity(normalized_idea_title, v_normalized)
    into v_fuzzy_id, v_fuzzy_score
  from submissions
  where status <> 'rejected'
    and similarity(normalized_idea_title, v_normalized) >= v_threshold
  order by similarity(normalized_idea_title, v_normalized) desc
  limit 1;

  if v_fuzzy_id is not null then
    insert into submissions (
      team_number, team_name, idea_title, idea_summary,
      normalized_idea_title, status, similar_to_id, similarity_score
    ) values (
      p_team_number, p_team_name, trim(p_idea_title), trim(p_idea_summary),
      v_normalized, 'flagged', v_fuzzy_id, v_fuzzy_score
    ) returning id into v_new_id;

    return jsonb_build_object('status', 'flagged', 'id', v_new_id);
  end if;

  -- 6. Otherwise, pending
  insert into submissions (
    team_number, team_name, idea_title, idea_summary,
    normalized_idea_title, status
  ) values (
    p_team_number, p_team_name, trim(p_idea_title), trim(p_idea_summary),
    v_normalized, 'pending'
  ) returning id into v_new_id;

  return jsonb_build_object('status', 'pending', 'id', v_new_id);
end;
$$;

grant execute on function submit_idea(int, text, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- organizer_set_status(): approve / reject / revoke, admin-token gated
-- ─────────────────────────────────────────────────────────────────────────

create or replace function organizer_set_status(
  p_submission_id bigint,
  p_new_status text,
  p_reason text,
  p_admin_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous text;
  v_action text;
  v_normalized text;
  v_team_number int;
begin
  perform check_admin_token(p_admin_token);

  if p_new_status not in ('approved', 'rejected') then
    raise exception 'Invalid target status';
  end if;

  select status, normalized_idea_title, team_number
    into v_previous, v_normalized, v_team_number
  from submissions where id = p_submission_id
  for update;

  if v_previous is null then
    raise exception 'Submission not found';
  end if;

  if p_new_status = 'approved' then
    if exists (
      select 1 from submissions
      where normalized_idea_title = v_normalized
        and status = 'approved'
        and id <> p_submission_id
    ) then
      raise exception 'Another submission with this title is already approved';
    end if;
    if exists (
      select 1 from submissions
      where team_number = v_team_number
        and status = 'approved'
        and id <> p_submission_id
    ) then
      raise exception 'This team already has an approved idea';
    end if;
    v_action := 'approve';
  elsif v_previous = 'approved' then
    v_action := 'revoke';
  else
    v_action := 'reject';
  end if;

  update submissions
  set status = p_new_status, updated_at = now()
  where id = p_submission_id;

  insert into audit_log (submission_id, previous_status, new_status, action, reason, actor)
  values (p_submission_id, v_previous, p_new_status, v_action, p_reason, 'organizer');

  return jsonb_build_object('status', p_new_status, 'id', p_submission_id);
end;
$$;

grant execute on function organizer_set_status(bigint, text, text, uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- organizer_set_event_state(): start / close the sprint, edit brief + timer
-- ─────────────────────────────────────────────────────────────────────────

create or replace function organizer_set_event_state(
  p_new_status text,
  p_brief_text text,
  p_display_duration_seconds int,
  p_admin_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform check_admin_token(p_admin_token);

  if p_new_status not in ('not_started', 'running', 'closed') then
    raise exception 'Invalid event status';
  end if;

  update event_state
  set
    status = p_new_status,
    brief_text = coalesce(p_brief_text, brief_text),
    display_duration_seconds = coalesce(p_display_duration_seconds, display_duration_seconds),
    display_started_at = case
      when p_new_status = 'running' and status is distinct from 'running' then now()
      else display_started_at
    end,
    updated_at = now()
  where id = 1;

  return jsonb_build_object('status', p_new_status);
end;
$$;

grant execute on function organizer_set_event_state(text, text, int, uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Organizer-only reads: pending/flagged/approved submissions and the audit
-- log are NOT publicly selectable (see RLS above), so the admin panel reads
-- them through these token-gated functions instead of raw table grants.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function organizer_list_submissions(
  p_admin_token uuid,
  p_statuses text[]
)
returns setof submissions
language plpgsql
security definer
set search_path = public
as $$
begin
  perform check_admin_token(p_admin_token);
  return query
    select * from submissions
    where status = any(p_statuses)
    order by submitted_at asc;
end;
$$;

grant execute on function organizer_list_submissions(uuid, text[]) to anon, authenticated;

create or replace function organizer_list_audit_log(
  p_admin_token uuid,
  p_limit int default 100
)
returns setof audit_log
language plpgsql
security definer
set search_path = public
as $$
begin
  perform check_admin_token(p_admin_token);
  return query
    select * from audit_log
    order by created_at desc
    limit p_limit;
end;
$$;

grant execute on function organizer_list_audit_log(uuid, int) to anon, authenticated;

-- Fetch a specific set of submissions by id (used to render the flagged
-- "matched against" side-by-side, which may reference an approved row the
-- public policy already allows, or a still-pending one it doesn't).
create or replace function organizer_get_submissions_by_id(
  p_admin_token uuid,
  p_ids bigint[]
)
returns setof submissions
language plpgsql
security definer
set search_path = public
as $$
begin
  perform check_admin_token(p_admin_token);
  return query select * from submissions where id = any(p_ids);
end;
$$;

grant execute on function organizer_get_submissions_by_id(uuid, bigint[]) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table submissions;
alter publication supabase_realtime add table event_state;
