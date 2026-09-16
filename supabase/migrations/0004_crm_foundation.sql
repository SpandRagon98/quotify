-- Additive CRM foundation. Historical app_state, sheets and public quote RPCs stay intact.
begin;
create schema if not exists crm_private;
revoke all on schema crm_private from public, anon, authenticated;
alter table public.org_members drop constraint org_members_role_check;
alter table public.org_members add constraint org_members_role_check check
 (role in ('owner','admin','editor','doc_viewer','sales_manager','sales_user','finance','viewer'));

create table public.crm_teams (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 name text not null check (length(trim(name)) between 1 and 120), created_at timestamptz not null default now(), unique(org_id,id), unique(org_id,name)
);
alter table public.org_members add column team_id uuid;
alter table public.org_members add constraint member_team_workspace foreign key(org_id,team_id) references public.crm_teams(org_id,id);

create function public.crm_can(p_org uuid,p_module text,p_action text,p_owner uuid default null)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare r text; my_team uuid; their_team uuid; visible boolean;
begin
 select role,team_id into r,my_team from org_members where org_id=p_org and user_id=auth.uid();
 if r is null then return false; end if;
 if p_module not in ('leads','accounts','contacts','opportunities','activities','inbox','quotations','documents','reports','workflows','settings','users')
    or p_action not in ('view','create','edit','delete','export','manage_all') then return false; end if;
 if r in ('owner','admin') then return true; end if;
 if p_module in ('users','workflows') then return false; end if;
 if p_module='settings' then return p_action='view'; end if;
 if r='doc_viewer' then return p_module='documents' and p_action='view'; end if;
 if r='viewer' then return p_action='view'; end if;
 if r='finance' then
   return (p_module in ('accounts','contacts','opportunities','reports') and p_action='view')
       or (p_module in ('quotations','documents') and p_action in ('view','create','edit','export'));
 end if;
 if r='editor' then return p_action not in ('delete','manage_all'); end if;
 if p_action='manage_all' then return false; end if;
 select team_id into their_team from org_members where org_id=p_org and user_id=p_owner;
 visible := p_owner=auth.uid() or (r='sales_manager' and my_team is not null and my_team=their_team);
 if p_module='reports' then return p_action='view'; end if;
 if p_action='create' and p_owner is null then return true; end if;
 return coalesce(visible,false) and (p_action<>'delete' or r='sales_manager');
end $$;
revoke all on function public.crm_can(uuid,text,text,uuid) from public,anon;
grant execute on function public.crm_can(uuid,text,text,uuid) to authenticated;

create table public.crm_accounts (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 owner_id uuid not null default auth.uid(), name text not null check(length(trim(name)) between 1 and 200),
 account_type text not null default 'Prospect', industry text, website text, phone text, email text,
 gstin text, pan text, billing_address text, shipping_address text, city text, state text, country text, pincode text,
 annual_revenue numeric(18,2) check(annual_revenue>=0), tags text[] not null default '{}', notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 unique(org_id,id), foreign key(org_id,owner_id) references public.org_members(org_id,user_id)
);
create table public.crm_contacts (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 owner_id uuid not null default auth.uid(), account_id uuid not null, first_name text not null check(length(trim(first_name)) between 1 and 120), last_name text,
 designation text, department text, email text, phone text, alternate_phone text, is_primary boolean not null default false,
 is_decision_maker boolean not null default false, notes text, tags text[] not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 unique(org_id,id), unique(org_id,account_id,id), foreign key(org_id,account_id) references public.crm_accounts(org_id,id),
 foreign key(org_id,owner_id) references public.org_members(org_id,user_id)
);
create unique index crm_contact_primary on public.crm_contacts(org_id,account_id) where is_primary and archived_at is null;
create table public.crm_opportunities (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 owner_id uuid not null default auth.uid(), account_id uuid not null, contact_id uuid,
 name text not null check(length(trim(name)) between 1 and 200), amount numeric(18,2) not null default 0 check(amount>=0), currency text not null default 'INR' check(currency ~ '^[A-Z]{3}$'),
 stage text not null default 'Qualification' check(stage in ('Qualification','Discovery','Demo/Meeting','Proposal/Quotation','Negotiation','Won','Lost')),
 probability integer not null default 10 check(probability between 0 and 100), probability_override boolean not null default false,
 expected_close_date date, source text not null default 'Manual', product text, description text, competitor text, next_step text, lost_reason text,
 closed_at timestamptz, tags text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 unique(org_id,id), unique(org_id,account_id,id), foreign key(org_id,account_id) references public.crm_accounts(org_id,id),
 foreign key(org_id,account_id,contact_id) references public.crm_contacts(org_id,account_id,id),
 foreign key(org_id,owner_id) references public.org_members(org_id,user_id)
);
create table public.crm_leads (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 owner_id uuid not null default auth.uid(), name text not null check(length(trim(name)) between 1 and 200), company_name text, first_name text, last_name text,
 email text, phone text, alternate_phone text, designation text, source text not null default 'Manual',
 status text not null default 'New' check(status in ('New','Attempted Contact','Contacted','Qualified','Unqualified','Converted','Lost')),
 stage text not null default 'Enquiry', product text, estimated_value numeric(18,2) not null default 0 check(estimated_value>=0),
 priority text not null default 'Normal' check(priority in ('Low','Normal','High','Urgent')), industry text, city text, state text, country text, pincode text, website text,
 notes text, tags text[] not null default '{}', last_contacted_at timestamptz, next_follow_up_at timestamptz, assigned_at timestamptz not null default now(),
 converted_at timestamptz, converted_account_id uuid, converted_contact_id uuid, converted_opportunity_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 unique(org_id,id), foreign key(org_id,owner_id) references public.org_members(org_id,user_id),
 foreign key(org_id,converted_account_id) references public.crm_accounts(org_id,id),
 foreign key(org_id,converted_account_id,converted_contact_id) references public.crm_contacts(org_id,account_id,id),
 foreign key(org_id,converted_account_id,converted_opportunity_id) references public.crm_opportunities(org_id,account_id,id)
);
create table public.crm_activities (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 owner_id uuid not null default auth.uid(), title text not null check(length(trim(title)) between 1 and 200),
 activity_type text not null default 'Task' check(activity_type in ('Task','Call','Meeting','Follow-up','Email','Note')),
 description text, lead_id uuid, account_id uuid, contact_id uuid, opportunity_id uuid,
 due_at timestamptz, reminder_at timestamptz, status text not null default 'Pending' check(status in ('Pending','In Progress','Completed','Cancelled','Overdue')),
 priority text not null default 'Normal' check(priority in ('Low','Normal','High','Urgent')), outcome text, completed_at timestamptz,
 overdue_notified_at timestamptz, reminder_notified_at timestamptz, created_by uuid not null default auth.uid() references auth.users,
 tags text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 unique(org_id,id), foreign key(org_id,owner_id) references public.org_members(org_id,user_id),
 foreign key(org_id,lead_id) references public.crm_leads(org_id,id), foreign key(org_id,account_id) references public.crm_accounts(org_id,id),
 foreign key(org_id,account_id,contact_id) references public.crm_contacts(org_id,account_id,id),
 foreign key(org_id,account_id,opportunity_id) references public.crm_opportunities(org_id,account_id,id),
 check ((contact_id is null and opportunity_id is null) or account_id is not null)
);
create table public.crm_inbox (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 owner_id uuid not null default auth.uid(), source text not null default 'Manual', source_identifier text, source_timestamp timestamptz,
 raw_payload jsonb not null default '{}', mapped_fields jsonb not null default '{}', name text not null check(length(trim(name)) between 1 and 200),
 company_name text, phone text, email text, status text not null default 'New' check(status in ('New','Accepted','Merged','Rejected','Spam')),
 lead_id uuid, tags text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 unique(org_id,id), foreign key(org_id,owner_id) references public.org_members(org_id,user_id), foreign key(org_id,lead_id) references public.crm_leads(org_id,id),
 check(pg_column_size(raw_payload)<262144 and pg_column_size(mapped_fields)<65536)
);
create unique index crm_inbox_source_unique on public.crm_inbox(org_id,source,source_identifier) where source_identifier is not null;
create table public.crm_quote_links (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 owner_id uuid not null default auth.uid(), account_id uuid not null, contact_id uuid, opportunity_id uuid, lead_id uuid,
 preset_id text not null, preset_name text not null, quotation_id text not null, amount numeric(18,2) check(amount>=0), currency text not null default 'INR' check(currency ~ '^[A-Z]{3}$'),
 doc_type text not null default 'native' check(doc_type in ('native','googledoc')), doc_url text, values_snapshot jsonb not null default '{}', status text not null default 'Saved', tags text[] not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 unique(org_id,id), unique(org_id,preset_id,quotation_id), foreign key(org_id,owner_id) references public.org_members(org_id,user_id),
 foreign key(org_id,account_id) references public.crm_accounts(org_id,id), foreign key(org_id,lead_id) references public.crm_leads(org_id,id),
 foreign key(org_id,account_id,contact_id) references public.crm_contacts(org_id,account_id,id),
 foreign key(org_id,account_id,opportunity_id) references public.crm_opportunities(org_id,account_id,id)
);
create table public.crm_events (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 owner_id uuid not null, entity_type text not null, entity_id uuid not null, account_id uuid, lead_id uuid, contact_id uuid, opportunity_id uuid,
 event_type text not null, title text not null, detail text, actor_id uuid references auth.users on delete set null, created_at timestamptz not null default now(),
 foreign key(org_id,account_id) references public.crm_accounts(org_id,id), foreign key(org_id,lead_id) references public.crm_leads(org_id,id)
);
create table public.crm_notifications (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 user_id uuid not null, title text not null, body text, entity_type text, entity_id uuid, dedupe_key text not null,
 read_at timestamptz, dismissed_at timestamptz, created_at timestamptz not null default now(), unique(org_id,user_id,dedupe_key),
 foreign key(org_id,user_id) references public.org_members(org_id,user_id) on delete cascade
);

-- Normalize and protect immutable server fields, validate relationship visibility.
create function crm_private.validate_record() returns trigger language plpgsql security definer set search_path=public as $$
declare d jsonb; old_d jsonb; relation record; module text := substring(tg_table_name from 5); rel_owner uuid;
begin
 d:=to_jsonb(new);
 if tg_op='UPDATE' then
  old_d:=to_jsonb(old);
  if new.id<>old.id or new.org_id<>old.org_id or new.created_at<>old.created_at then raise exception 'Immutable record identity'; end if;
  if new.archived_at is distinct from old.archived_at and auth.uid() is not null
     and not crm_can(new.org_id,case module when 'quote_links' then 'quotations' else module end,'delete',old.owner_id) then raise exception 'Archive permission required'; end if;
 end if;
 if not exists(select 1 from org_members where org_id=new.org_id and user_id=new.owner_id) then raise exception 'Owner must belong to this workspace'; end if;
 if d->>'email' is not null then
  new.email:=nullif(lower(trim(new.email)),'');
  if new.email is not null and new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
 end if;
 if auth.uid() is not null and coalesce(current_setting('qyrova.workflow',true),'')<>'on' then
  for relation in select * from (values ('account_id','crm_accounts','accounts'),('contact_id','crm_contacts','contacts'),('opportunity_id','crm_opportunities','opportunities'),('lead_id','crm_leads','leads')) as r(field,tab,cap) loop
   if nullif(d->>relation.field,'') is not null then
    execute format('select owner_id from public.%I where org_id=$1 and id=$2 and archived_at is null',relation.tab) into rel_owner using new.org_id,(d->>relation.field)::uuid;
    if rel_owner is null or not crm_can(new.org_id,relation.cap,'view',rel_owner) then raise exception 'Related record is unavailable'; end if;
   end if;
  end loop;
 end if;
 if tg_table_name='crm_leads' then
  if tg_op='INSERT' and (new.converted_at is not null or new.status='Converted' or new.converted_account_id is not null or new.converted_contact_id is not null or new.converted_opportunity_id is not null) then raise exception 'Use Convert Lead'; end if;
  if tg_op='UPDATE' and coalesce(current_setting('qyrova.converting',true),'')<>'on' then
   if (new.converted_at,new.converted_account_id,new.converted_contact_id,new.converted_opportunity_id) is distinct from (old.converted_at,old.converted_account_id,old.converted_contact_id,old.converted_opportunity_id)
      or (new.status='Converted' and old.status<>'Converted') then raise exception 'Use Convert Lead'; end if;
   if old.converted_at is not null and new.status<>'Converted' then raise exception 'Converted leads retain their conversion status'; end if;
  end if;
  if tg_op='UPDATE' and new.owner_id<>old.owner_id then new.assigned_at:=now(); end if;
 end if;
 if tg_table_name='crm_opportunities' then
  if new.stage='Lost' and nullif(trim(new.lost_reason),'') is null then raise exception 'Enter a lost reason'; end if;
  if new.stage in ('Won','Lost') or not new.probability_override then
   new.probability:=case new.stage when 'Qualification' then 10 when 'Discovery' then 20 when 'Demo/Meeting' then 40 when 'Proposal/Quotation' then 60 when 'Negotiation' then 80 when 'Won' then 100 else 0 end;
  end if;
  if new.stage in ('Won','Lost') then new.closed_at:=coalesce(new.closed_at,now()); else new.closed_at:=null; end if;
 end if;
 if tg_table_name='crm_activities' then
  if new.activity_type not in ('Note','Email') and new.status in ('Pending','In Progress','Overdue') and new.due_at is null then raise exception 'Open activities require a due date and time'; end if;
  if tg_op='INSERT' and auth.uid() is not null then new.created_by:=auth.uid(); end if;
  if tg_op='UPDATE' then
   new.created_by:=old.created_by;
   if new.due_at is distinct from old.due_at or new.status='Completed' then new.overdue_notified_at:=null; end if;
   if new.reminder_at is distinct from old.reminder_at then new.reminder_notified_at:=null; end if;
  end if;
  if new.status='Completed' then new.completed_at:=coalesce(new.completed_at,now()); else new.completed_at:=null; end if;
  if new.status in ('Pending','In Progress','Overdue') and new.due_at<now() then new.status:='Overdue';
  elsif new.status='Overdue' then new.status:='Pending'; end if;
 end if;
 new.updated_at:=now();
 return new;
end $$;

do $$ declare t text; cap text; begin
 for t,cap in select * from (values ('crm_accounts','accounts'),('crm_contacts','contacts'),('crm_leads','leads'),('crm_opportunities','opportunities'),('crm_activities','activities'),('crm_inbox','inbox'),('crm_quote_links','quotations')) x(t,cap) loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('create policy crm_read on public.%I for select to authenticated using (public.crm_can(org_id,%L,''view'',owner_id))',t,cap);
  execute format('create policy crm_create on public.%I for insert to authenticated with check (public.crm_can(org_id,%L,''create'',owner_id))',t,cap);
  execute format('create policy crm_update on public.%I for update to authenticated using (public.crm_can(org_id,%L,''edit'',owner_id)) with check (public.crm_can(org_id,%L,''edit'',owner_id))',t,cap,cap);
  execute format('create trigger validate_crm before insert or update on public.%I for each row execute function crm_private.validate_record()',t);
  execute format('create index %I on public.%I (org_id,owner_id,created_at desc) where archived_at is null',t||'_owner_date',t);
  execute format('create index %I on public.%I using gin(tags)',t||'_tags',t);
 end loop;
end $$;
create index crm_leads_filters on public.crm_leads(org_id,status,source,priority) where archived_at is null;
create index crm_leads_email on public.crm_leads(org_id,lower(email)) where archived_at is null;
create index crm_leads_phone on public.crm_leads(org_id,regexp_replace(phone,'[^0-9]','','g')) where archived_at is null;
create index crm_leads_company on public.crm_leads(org_id,lower(company_name),lower(name)) where archived_at is null;
create index crm_accounts_name on public.crm_accounts(org_id,lower(name)) where archived_at is null;
create index crm_opportunity_stage on public.crm_opportunities(org_id,stage,expected_close_date) where archived_at is null;
create index crm_opportunity_account on public.crm_opportunities(org_id,account_id) where archived_at is null;
create index crm_contacts_account on public.crm_contacts(org_id,account_id) where archived_at is null;
create index crm_activities_due on public.crm_activities(org_id,owner_id,status,due_at) where archived_at is null;
create index crm_activities_account on public.crm_activities(org_id,account_id,due_at) where archived_at is null;
create index crm_quote_account on public.crm_quote_links(org_id,account_id,created_at desc);
create index crm_events_account on public.crm_events(org_id,account_id,created_at desc);
create index crm_events_lead on public.crm_events(org_id,lead_id,created_at desc);
create index crm_notif_user on public.crm_notifications(org_id,user_id,created_at desc);
do $$ declare t text; expression text; begin
 for t,expression in select * from (values
  ('crm_leads', 'coalesce(name,'''') || '' '' || coalesce(company_name,'''') || '' '' || coalesce(email,'''') || '' '' || coalesce(phone,'''')'),
  ('crm_accounts','coalesce(name,'''') || '' '' || coalesce(email,'''') || '' '' || coalesce(phone,'''')'),
  ('crm_contacts','coalesce(first_name,'''') || '' '' || coalesce(last_name,'''') || '' '' || coalesce(email,'''') || '' '' || coalesce(phone,'''')'),
  ('crm_opportunities','coalesce(name,'''') || '' '' || coalesce(product,'''')'),
  ('crm_activities','coalesce(title,'''') || '' '' || coalesce(description,'''')'),
  ('crm_inbox','coalesce(name,'''') || '' '' || coalesce(company_name,'''') || '' '' || coalesce(email,'''') || '' '' || coalesce(phone,'''')'),
  ('crm_quote_links','quotation_id || '' '' || preset_name')) x(t,e) loop
  execute format('alter table public.%I add column search tsvector generated always as (to_tsvector(''simple'',%s)) stored',t,expression);
  execute format('create index %I on public.%I using gin(search)',t||'_search',t);
 end loop;
end $$;
alter table public.crm_events enable row level security;
alter table public.crm_notifications enable row level security;
alter table public.crm_teams enable row level security;
revoke all on public.crm_events,public.crm_notifications,public.crm_teams from authenticated;
grant select on public.crm_events,public.crm_teams to authenticated;
grant select,update(read_at,dismissed_at) on public.crm_notifications to authenticated;
revoke all on public.crm_events,public.crm_notifications,public.crm_teams from anon;
create policy crm_events_read on public.crm_events for select to authenticated using
 (crm_can(org_id,case entity_type when 'quote_links' then 'quotations' else entity_type end,'view',owner_id));
create policy crm_notif_read on public.crm_notifications for select to authenticated using(user_id=auth.uid() and is_org_member(org_id));
create policy crm_notif_update on public.crm_notifications for update to authenticated using(user_id=auth.uid() and is_org_member(org_id)) with check(user_id=auth.uid() and is_org_member(org_id));
create policy crm_teams_read on public.crm_teams for select to authenticated using(is_org_member(org_id));

-- Restrict legacy cloud configuration writes for read-only/commercial roles.
drop policy app_state_member_all on public.app_state;
create policy app_state_read on public.app_state for select to authenticated using(is_org_member(org_id));
create policy app_state_write on public.app_state for all to authenticated using(org_role(org_id) in ('owner','admin','editor')) with check(org_role(org_id) in ('owner','admin','editor'));
-- Membership mutations go through audited admin RPCs; admin cannot mint an Owner.
revoke insert,update,delete on public.org_members from authenticated;
drop policy tracked_quotes_member_select on public.tracked_quotes;
drop policy tracked_quotes_member_insert on public.tracked_quotes;
drop policy tracked_quotes_member_update on public.tracked_quotes;
drop policy tracked_quotes_member_delete on public.tracked_quotes;
create policy tracked_quotes_member_select on public.tracked_quotes for select to authenticated using(crm_can(org_id,'quotations','view',created_by));
create policy tracked_quotes_member_insert on public.tracked_quotes for insert to authenticated with check(created_by=auth.uid() and crm_can(org_id,'quotations','create',created_by));
create policy tracked_quotes_member_update on public.tracked_quotes for update to authenticated using(crm_can(org_id,'quotations','edit',created_by)) with check(crm_can(org_id,'quotations','edit',created_by));
create policy tracked_quotes_member_delete on public.tracked_quotes for delete to authenticated using(crm_can(org_id,'quotations','delete',created_by));
commit;
