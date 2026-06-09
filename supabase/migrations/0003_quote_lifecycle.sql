-- =====================================================================
-- Qyrova — Phase 3: quote lifecycle (expiry, signature, versioning)
--
-- Run this ONCE in Supabase SQL Editor AFTER 0002_tracked_quotes.sql.
--
-- Extends tracked quotes into a real sales artifact:
--   * "valid until" expiry (auto-flips to 'expired', blocks late responses)
--   * lightweight typed-name acceptance signature
--   * versioning — re-sending a revised quote keeps full history (thread_id +
--     version, prior versions marked superseded)
--   * updated_at, so the app can poll for real status changes and notify.
-- =====================================================================

-- ---------- New columns ----------

alter table public.tracked_quotes
  add column if not exists expires_at  timestamptz,
  add column if not exists signed_name text,
  add column if not exists version     int  not null default 1,
  add column if not exists thread_id   uuid,
  add column if not exists superseded  boolean not null default false,
  add column if not exists updated_at  timestamptz not null default now();

-- Backfill thread_id for any existing rows (each is its own thread).
update public.tracked_quotes set thread_id = id where thread_id is null;

create index if not exists tracked_quotes_thread_idx
  on public.tracked_quotes (thread_id, version desc);

-- ---------- Widen the status vocabulary (draft → sent → viewed → …) ----------

alter table public.tracked_quotes drop constraint if exists tracked_quotes_status_check;
alter table public.tracked_quotes
  add constraint tracked_quotes_status_check
  check (status in ('draft','sent','viewed','approved','accepted','declined','negotiate','expired'));

-- ---------- Keep updated_at fresh ----------

create or replace function public.touch_tracked_quote()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_tracked_quote on public.tracked_quotes;
create trigger trg_touch_tracked_quote
  before update on public.tracked_quotes
  for each row execute function public.touch_tracked_quote();

-- ---------- Members may update their org's quotes (revise / supersede) ----------

drop policy if exists "tracked_quotes_member_update" on public.tracked_quotes;
create policy "tracked_quotes_member_update" on public.tracked_quotes
  for update using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

grant update on public.tracked_quotes to authenticated;

-- ---------- Public capability functions (token = the key) ----------

-- Read a quote by token + a derived is_expired flag.
create or replace function public.get_tracked_quote(p_token text)
returns jsonb language sql security definer set search_path = public as $$
  select (to_jsonb(q) - 'org_id' - 'created_by')
         || jsonb_build_object(
              'is_expired',
              q.expires_at is not null and q.expires_at < now()
                and q.status in ('sent','viewed'))
  from public.tracked_quotes q
  where q.token = p_token;
$$;

-- Log a view; auto-flip to 'expired' once past the valid-until date.
create or replace function public.record_quote_view(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare q record;
begin
  select * into q from public.tracked_quotes where token = p_token;
  if not found then return; end if;

  if q.expires_at is not null and q.expires_at < now()
     and q.status in ('sent','viewed') then
    update public.tracked_quotes
      set status = 'expired',
          view_count = view_count + 1,
          last_viewed_at = now(),
          first_viewed_at = coalesce(first_viewed_at, now())
      where id = q.id;
  else
    update public.tracked_quotes
      set view_count = view_count + 1,
          last_viewed_at = now(),
          first_viewed_at = coalesce(first_viewed_at, now()),
          status = case when status = 'sent' then 'viewed' else status end
      where id = q.id;
  end if;

  insert into public.quote_events (quote_id, type) values (q.id, 'view');
end;
$$;

-- Replace the 3-arg responder with a 4-arg version that also takes a signature.
drop function if exists public.respond_to_quote(text, text, text);
create or replace function public.respond_to_quote(
  p_token text, p_response text, p_note text default null, p_signed_name text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q record; new_status text;
begin
  if p_response not in ('approved','declined','negotiate') then
    raise exception 'invalid response';
  end if;

  select * into q from public.tracked_quotes where token = p_token;
  if not found then raise exception 'quote not found'; end if;

  -- Already finalized → return current state idempotently.
  if q.status in ('approved','declined') then
    return jsonb_build_object('status', q.status, 'already', true);
  end if;

  -- Expired → block and record the expiry.
  if q.expires_at is not null and q.expires_at < now() then
    update public.tracked_quotes set status = 'expired'
      where id = q.id and status in ('sent','viewed');
    raise exception 'This quotation has expired.';
  end if;

  update public.tracked_quotes
    set status        = p_response,
        responded_at  = now(),
        response_note = coalesce(nullif(trim(p_note), ''), response_note),
        signed_name   = coalesce(nullif(trim(p_signed_name), ''), signed_name)
    where id = q.id
    returning status into new_status;

  insert into public.quote_events (quote_id, type, note)
    values (q.id, p_response, nullif(trim(p_note), ''));

  return jsonb_build_object('status', new_status);
end;
$$;

grant execute on function public.get_tracked_quote(text)                  to anon, authenticated;
grant execute on function public.record_quote_view(text)                  to anon, authenticated;
grant execute on function public.respond_to_quote(text, text, text, text) to anon, authenticated;
