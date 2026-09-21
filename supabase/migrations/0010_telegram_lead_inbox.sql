-- Telegram is an inbound Lead Inbox connector. Bot credentials remain in
-- Supabase Edge Function secrets; this migration stores only safe connection
-- metadata plus the short-lived conversation and webhook-deduplication state.
begin;

create table public.crm_telegram_integration (
  singleton boolean primary key default true check (singleton),
  org_id uuid not null references public.organizations on delete cascade,
  bot_username text not null default '',
  webhook_url text not null default '',
  connected_at timestamptz,
  last_error text not null default '',
  updated_at timestamptz not null default now()
);

create table public.crm_telegram_sessions (
  chat_id bigint primary key,
  org_id uuid not null references public.organizations on delete cascade,
  step text not null check (step in ('name', 'business', 'contact', 'requirement')),
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.crm_telegram_updates (
  update_id bigint primary key,
  processed_at timestamptz not null default now()
);

create index crm_telegram_sessions_org_updated
  on public.crm_telegram_sessions(org_id, updated_at desc);
create index crm_telegram_updates_processed
  on public.crm_telegram_updates(processed_at);

alter table public.crm_telegram_integration enable row level security;
alter table public.crm_telegram_sessions enable row level security;
alter table public.crm_telegram_updates enable row level security;

revoke all on public.crm_telegram_integration, public.crm_telegram_sessions,
  public.crm_telegram_updates from public, anon, authenticated;
grant select on public.crm_telegram_integration to authenticated;

create policy crm_telegram_integration_read
  on public.crm_telegram_integration for select to authenticated
  using (public.is_org_member(org_id));

commit;
