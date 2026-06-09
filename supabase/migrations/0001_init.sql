-- =====================================================================
-- Qyrova — Phase 0 multi-tenant backend (Supabase / Postgres)
--
-- Run this ONCE in your Supabase project: SQL Editor → paste → Run.
-- It creates the schema, Row-Level Security policies (tenant isolation), and a
-- trigger that gives every new account its own private organization.
--
-- Model: one account → one organization (perfect for freelancers). All app data
-- (presets, company/document config, email templates) is stored as JSONB blobs
-- in `app_state`, isolated per organization by RLS. Team invites + granular RBAC
-- are a later increment; the schema already supports multiple members per org.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tables ----------

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  avatar_url     text,
  default_org_id uuid,
  created_at     timestamptz not null default now()
);

create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My workspace',
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner'
             check (role in ('owner','admin','editor','doc_viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Per-org key/value JSONB store: key ∈ {'presets','company_profiles','email_templates'}
create table if not exists public.app_state (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  key        text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

-- ---------- Helper functions (SECURITY DEFINER avoids RLS recursion) ----------

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.org_role(target_org uuid)
returns text language sql security definer set search_path = public as $$
  select role from public.org_members
  where org_id = target_org and user_id = auth.uid();
$$;

-- ---------- Row-Level Security ----------

alter table public.profiles      enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members   enable row level security;
alter table public.app_state     enable row level security;

-- profiles: a user sees/edits only their own row (insert handled by trigger)
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- organizations: members can read; owner can rename
create policy "orgs_member_select" on public.organizations
  for select using (public.is_org_member(id));
create policy "orgs_owner_update" on public.organizations
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- org_members: members can read their orgs' membership; owner/admin can manage
create policy "members_select" on public.org_members
  for select using (public.is_org_member(org_id));
create policy "members_manage" on public.org_members
  for all
  using (public.org_role(org_id) in ('owner','admin'))
  with check (public.org_role(org_id) in ('owner','admin'));

-- app_state: any member of the org can read/write its data
create policy "app_state_member_all" on public.app_state
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- ---------- Auto-provision a personal org for every new account ----------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org uuid;
  display text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'My');
begin
  insert into public.organizations (name, owner_id)
    values (display || '''s workspace', new.id)
    returning id into new_org;

  insert into public.org_members (org_id, user_id, role)
    values (new_org, new.id, 'owner');

  insert into public.profiles (id, full_name, avatar_url, default_org_id)
    values (new.id, new.raw_user_meta_data->>'full_name', null, new_org);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Grants (RLS still restricts every row) ----------

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.profiles, public.organizations, public.org_members, public.app_state
  to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.org_role(uuid) to authenticated;
