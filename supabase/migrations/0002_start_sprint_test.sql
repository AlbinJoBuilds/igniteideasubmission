-- IgniteX — Start sprint for testing
-- Run via the Supabase SQL Editor to kick off a test sprint session.

-- 1. Create a test admin session token (bypasses the Edge Function PIN check)
INSERT INTO admin_sessions (token, expires_at)
VALUES ('11111111-1111-1111-1111-111111111111', now() + interval '4 hours')
ON CONFLICT (token) DO UPDATE SET expires_at = now() + interval '4 hours';

-- 2. Start the sprint with a 15-minute cosmetic countdown
UPDATE event_state
SET status = 'running',
    display_started_at = now(),
    display_duration_seconds = 900,
    updated_at = now()
WHERE id = 1;
