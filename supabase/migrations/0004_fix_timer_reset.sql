-- Reset the display timer anchor whenever the organizer changes the sprint duration
-- or starts the sprint again. This prevents stale started_at timestamps from
-- creating huge or incorrect countdown values.

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
declare
  v_current_status text;
begin
  perform check_admin_token(p_admin_token);

  if p_new_status not in ('not_started', 'running', 'closed') then
    raise exception 'Invalid event status';
  end if;

  select status into v_current_status
  from event_state
  where id = 1
  for update;

  update event_state
  set
    status = p_new_status,
    brief_text = coalesce(p_brief_text, brief_text),
    display_duration_seconds = coalesce(p_display_duration_seconds, display_duration_seconds),
    display_started_at = case
      when p_new_status = 'running' then now()
      when v_current_status = 'running' and p_display_duration_seconds is not null then now()
      else display_started_at
    end,
    updated_at = now()
  where id = 1;

  return jsonb_build_object('status', p_new_status);
end;
$$;

grant execute on function organizer_set_event_state(text, text, int, uuid) to anon, authenticated;
