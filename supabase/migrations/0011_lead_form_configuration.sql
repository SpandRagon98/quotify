-- Per-workspace lead form configuration. Existing lead records and fields remain intact.
begin;

alter table public.crm_leads
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table public.crm_leads
  add constraint crm_leads_custom_fields_object
  check (jsonb_typeof(custom_fields) = 'object' and pg_column_size(custom_fields) < 65536);

create table public.crm_lead_form_configs (
  org_id uuid primary key references public.organizations on delete cascade,
  fields jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 30 and pg_column_size(fields) < 32768)
);

alter table public.crm_lead_form_configs enable row level security;
revoke all on public.crm_lead_form_configs from public, anon;
revoke all on public.crm_lead_form_configs from authenticated;
grant select, insert, update on public.crm_lead_form_configs to authenticated;

create policy crm_lead_form_config_read on public.crm_lead_form_configs
  for select to authenticated
  using (public.crm_can(org_id, 'leads', 'view', auth.uid()));
create policy crm_lead_form_config_create on public.crm_lead_form_configs
  for insert to authenticated
  with check (public.crm_can(org_id, 'leads', 'edit', auth.uid()));
create policy crm_lead_form_config_update on public.crm_lead_form_configs
  for update to authenticated
  using (public.crm_can(org_id, 'leads', 'edit', auth.uid()))
  with check (public.crm_can(org_id, 'leads', 'edit', auth.uid()));

create function crm_private.touch_lead_form_config()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger touch_crm_lead_form_config
  before insert or update on public.crm_lead_form_configs
  for each row execute function crm_private.touch_lead_form_config();

commit;
