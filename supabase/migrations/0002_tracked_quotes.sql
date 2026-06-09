-- =====================================================================
-- Qyrova — Phase 1: tracked quotes
--
-- Run this ONCE in your Supabase project AFTER 0001_init.sql:
--   SQL Editor → paste → Run.
--
-- Adds a public, link-shareable quotation: each sent quote gets an
-- unguessable token. The recipient opens /q/<token> (no login) to view a
-- branded document, which logs a view and lets them Approve / Decline /
-- Negotiate. Owners see the live status + view count back in the app.
--
-- Security model:
--   - The org's members read their own quotes + events via RLS.
--   - The public (anon) NEVER queries the tables directly — they can only call
--     three SECURITY DEFINER functions that look a quote up BY ITS TOKEN. The
--     token is the capability; nothing can be enumerated.
-- =====================================================================

-- ---------- Tables ----------

create table if not exists public.tracked_quotes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  token           text not null unique,
  quotation_id    text,
  preset_name     text,
  recipient_email text,
  snapshot        jsonb not null default '{}'::jsonb, -- DocumentPreview render data
  status          text not null default 'sent'
                  check (status in ('sent','viewed','approved','declined','negotiate')),
  view_count      int  not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at  timestamptz,
  responded_at    timestamptz,
  response_note   text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists tracked_quotes_org_idx
  on public.tracked_quotes (org_id, created_at desc);
create index if not exists tracked_quotes_quotation_idx
  on public.tracked_quotes (org_id, quotation_id);

create table if not exists public.quote_events (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.tracked_quotes(id) on delete cascade,
  type       text not null check (type in ('view','approved','declined','negotiate')),
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists quote_events_quote_idx
  on public.quote_events (quote_id, created_at desc);

-- ---------- Row-Level Security (members only; public uses the RPCs below) ----------

alter table public.tracked_quotes enable row level security;
alter table public.quote_events   enable row level security;

create policy "tracked_quotes_member_select" on public.tracked_quotes
  for select using (public.is_org_member(org_id));

create policy "tracked_quotes_member_insert" on public.tracked_quotes
  for insert with check (public.is_org_member(org_id) and created_by = auth.uid());

-- Members can delete/manage their own org's quotes (e.g. revoke a link).
create policy "tracked_quotes_member_delete" on public.tracked_quotes
  for delete using (public.is_org_member(org_id));

create policy "quote_events_member_select" on public.quote_events
  for select using (
    exists (
      select 1 from public.tracked_quotes q
      where q.id = quote_events.quote_id and public.is_org_member(q.org_id)
    )
  );

-- ---------- Public capability functions (token = the access key) ----------

-- Read a quote by token (no side effects). Strips internal columns.
create or replace function public.get_tracked_quote(p_token text)
returns jsonb language sql security definer set search_path = public as $$
  select to_jsonb(q) - 'org_id' - 'created_by'
  from public.tracked_quotes q
  where q.token = p_token;
$$;

-- Log a view: bump counters, set first/last seen, flip 'sent' → 'viewed'.
create or replace function public.record_quote_view(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare qid uuid;
begin
  select id into qid from public.tracked_quotes where token = p_token;
  if qid is null then return; end if;
  update public.tracked_quotes
    set view_count      = view_count + 1,
        last_viewed_at  = now(),
        first_viewed_at = coalesce(first_viewed_at, now()),
        status          = case when status = 'sent' then 'viewed' else status end
    where id = qid;
  insert into public.quote_events (quote_id, type) values (qid, 'view');
end;
$$;

-- Record a response. p_response ∈ {approved, declined, negotiate}.
create or replace function public.respond_to_quote(
  p_token text, p_response text, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare qid uuid; new_status text;
begin
  if p_response not in ('approved','declined','negotiate') then
    raise exception 'invalid response';
  end if;
  select id into qid from public.tracked_quotes where token = p_token;
  if qid is null then raise exception 'quote not found'; end if;
  update public.tracked_quotes
    set status        = p_response,
        responded_at  = now(),
        response_note = coalesce(nullif(trim(p_note), ''), response_note)
    where id = qid
    returning status into new_status;
  insert into public.quote_events (quote_id, type, note)
    values (qid, p_response, nullif(trim(p_note), ''));
  return jsonb_build_object('status', new_status);
end;
$$;

-- ---------- Grants ----------

grant select, insert, delete on public.tracked_quotes to authenticated;
grant select on public.quote_events to authenticated;

-- The public capability functions are callable by anonymous visitors.
grant execute on function public.get_tracked_quote(text)            to anon, authenticated;
grant execute on function public.record_quote_view(text)            to anon, authenticated;
grant execute on function public.respond_to_quote(text, text, text) to anon, authenticated;
