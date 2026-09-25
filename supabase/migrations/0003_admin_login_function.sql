-- IgniteX — Database-level admin login (no Edge Function needed)
-- Default PIN: 1234

CREATE OR REPLACE FUNCTION admin_login(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected text := '1234';   -- change this to your desired PIN
  v_token uuid;
  v_expires timestamptz;
BEGIN
  IF p_pin IS NULL OR p_pin <> v_expected THEN
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;

  -- Clean up expired sessions
  DELETE FROM admin_sessions WHERE expires_at < now();

  v_expires := now() + interval '4 hours';

  INSERT INTO admin_sessions (expires_at)
  VALUES (v_expires)
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('token', v_token, 'expires_at', v_expires);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_login(text) TO anon, authenticated;
