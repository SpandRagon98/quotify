-- Interior-design lead questionnaire and a controlled public website intake.
-- Pricing is workspace-owned; the browser never stores a final quotation.
begin;

alter table public.crm_lead_form_configs
  add column if not exists interior_pricing jsonb not null default '{}'::jsonb
  check (jsonb_typeof(interior_pricing) = 'object' and pg_column_size(interior_pricing) < 16384);

create table public.crm_website_lead_forms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations on delete cascade,
  name text not null default 'Interior website questionnaire' check (length(trim(name)) between 1 and 120),
  allowed_origins text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(allowed_origins) <= 12)
);

create table public.crm_website_lead_requests (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.crm_website_lead_forms on delete cascade,
  fingerprint text not null check (length(fingerprint) = 64),
  created_at timestamptz not null default now()
);
create index crm_website_lead_requests_rate
  on public.crm_website_lead_requests(form_id, fingerprint, created_at desc);

alter table public.crm_website_lead_forms enable row level security;
alter table public.crm_website_lead_requests enable row level security;
revoke all on public.crm_website_lead_forms, public.crm_website_lead_requests from public, anon, authenticated;
grant select, insert, update on public.crm_website_lead_forms to authenticated;

create policy crm_website_lead_forms_read on public.crm_website_lead_forms
  for select to authenticated using (public.crm_can(org_id, 'leads', 'view', auth.uid()));
create policy crm_website_lead_forms_create on public.crm_website_lead_forms
  for insert to authenticated with check (public.crm_can(org_id, 'leads', 'edit', auth.uid()));
create policy crm_website_lead_forms_update on public.crm_website_lead_forms
  for update to authenticated using (public.crm_can(org_id, 'leads', 'edit', auth.uid()))
  with check (public.crm_can(org_id, 'leads', 'edit', auth.uid()));

create function crm_private.touch_website_lead_form()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end $$;
create trigger touch_crm_website_lead_form
  before insert or update on public.crm_website_lead_forms
  for each row execute function crm_private.touch_website_lead_form();

commit;
