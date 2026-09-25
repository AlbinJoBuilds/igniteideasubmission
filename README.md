# IgniteX — Topic Sprint

Live-event MVP built from the revised plan: QR team entry, one-idea-per-team
submission with server-side duplicate/fuzzy-match detection, a lightweight
password-gated admin panel (not the raw Supabase dashboard), a real-time
public board, manual open/close of the sprint (the countdown is cosmetic
only), and a full audit log.

## Stack

- **Frontend:** React 18 + Vite, React Router, `@supabase/supabase-js` (incl. Realtime)
- **Backend:** Supabase — Postgres, RLS, `pg_trgm`, `security definer` SQL functions, one Edge Function
- **No separate server** — Supabase is the entire backend; the frontend can be hosted anywhere static (Vercel/Netlify)

## Project layout

```
src/
  pages/          TeamEntry, SprintScreen, SubmissionScreen, LiveBoard, AdminLogin, AdminPanel
  components/     PixelBlast (placeholder — see below), StatusBadge, Countdown
  supabaseClient.js
supabase/
  migrations/0001_init.sql     full schema, RLS, and RPC functions
  functions/admin-auth/        Edge Function that checks the PIN and mints a session token
```

## 1. Create the Supabase project

1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_init.sql` in full (or `supabase db push` if you're using the CLI with this repo linked). This creates the tables, RLS policies, `pg_trgm` fuzzy matching, and all the `submit_idea` / `organizer_*` functions.
3. Enable Realtime is already handled by the migration (`alter publication supabase_realtime add table ...`) — no extra dashboard step needed.

## 2. Set the organizer PIN and deploy the Edge Function

```bash
supabase functions deploy admin-auth
supabase secrets set ADMIN_PIN=1234   # pick a real PIN
```

The admin panel never talks to Postgres directly for auth — it calls this
function, which checks the PIN and inserts a row into `admin_sessions`
(service-role only, not exposed via RLS). Every organizer action
(`organizer_set_status`, `organizer_set_event_state`, and the admin read
functions) re-checks that token server-side and rejects it once it's
expired (4-hour sessions) or absent — so raw table grants are never handed
to the browser for anything except the public `approved` rows.

## 3. Configure and run the frontend

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from
# Project Settings → API in the Supabase dashboard

npm install
npm run dev
```

Routes:

| Path           | Screen                                   |
|----------------|-------------------------------------------|
| `/`            | QR team entry                             |
| `/sprint`      | Brief, status badge, cosmetic countdown   |
| `/submit`      | Idea submission + result feedback         |
| `/board`       | Public live claimed-ideas board           |
| `/admin`       | Organizer PIN login                       |
| `/admin/panel` | Sprint control, review queue, audit log   |

For the event, point the QR code at `/` on whatever URL you deploy to.

## 4. Swap in your real PixelBlast component

`src/components/PixelBlast.jsx` is a placeholder (a slow ember-drift canvas)
standing in for the one referenced in the plan as "provided." Drop your
real component in at the same path with the same default export and
nothing else needs to change — it's only ever used as `<PixelBlast />`, a
fixed full-bleed background.

## How the plan's key decisions are implemented

- **Manual open/close, cosmetic countdown:** `submit_idea()` only checks
  `event_state.status = 'running'`. The countdown in `Countdown.jsx` is a
  pure display timer computed from `display_started_at` +
  `display_duration_seconds` — it cannot block or allow submissions itself,
  and closing the sprint is always an explicit `organizer_set_event_state`
  call from the panel.
- **Duplicate detection:** exact normalized-title matches against an
  *approved* idea are auto-rejected with an audit log row
  (`actor = 'system'`); fuzzy matches (`pg_trgm` `similarity() >= 0.6`,
  tunable in `submit_idea()`) are inserted as `flagged` with `similar_to_id`
  and `similarity_score` set, so the admin panel can render the
  side-by-side comparison.
- **Admin panel instead of raw Supabase dashboard:** all organizer writes
  and all reads of non-public rows (pending/flagged submissions, the audit
  log) go through `security definer` functions gated by `check_admin_token`,
  not through table grants — so the anon key alone can never see or change
  anything beyond `approved` submissions and `event_state`.
- **Audit log:** every status transition (`approve`, `reject`, `revoke`,
  `auto_reject_duplicate`) writes a row with previous/new status, actor, and
  an optional organizer-entered reason.

## Open decisions carried over from the plan

These were left open in the spec and have a default baked in — change them
where noted:

- **Fuzzy-match threshold:** `0.6`, set in the `v_threshold` variable inside
  `submit_idea()` in the migration. Tune during a dry run.
- **Admin PIN distribution:** up to you — the Edge Function just checks
  whatever you set as the `ADMIN_PIN` secret.
- **Countdown length:** organizer-adjustable at Start time (the "Cosmetic
  countdown length" field in the admin panel), defaulting to 15 minutes.
- **Grace period between Close and blocking submissions:** none — closing
  is immediate. If you want a grace window, it would go as an extra check
  in `submit_idea()` (e.g. compare `now()` against a `closes_at` timestamp
  instead of a hard status flip).
