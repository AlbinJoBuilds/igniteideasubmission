-- Remove the countdown/timer fields from the event state because the app now
-- runs with a manual organizer timer rather than an in-app automatic countdown.

alter table public.event_state
drop column if exists display_started_at,
drop column if exists display_duration_seconds;

create or replace function public.organizer_set_event_state(
  p_new_status text,
  p_brief_text text,
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
    updated_at = now()
  where id = 1;

  return jsonb_build_object('status', p_new_status);
end;
$$;

grant execute on function public.organizer_set_event_state(text, text, uuid) to anon, authenticated;
