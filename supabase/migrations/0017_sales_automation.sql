-- Sales automation: deterministic quote drafts, guarded email dispatch and
-- reviewable reply intelligence. Email/API secrets deliberately live only in
-- the Edge Function environment, never in this database or the browser.
begin;

create table public.crm_sales_automation_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  quotes_enabled boolean not null default true,
  auto_send_qualified_quotes boolean not null default false,
  reply_ai_enabled boolean not null default true,
  quote_subject_template text not null default 'Your quotation is ready — {{customer_name}}',
  quote_body_template text not null default 'Hello {{customer_name}},\n\nThank you for your interest in {{product}}. We have prepared your quotation for {{amount}}. Reply to this email if you would like to discuss any changes.\n\nRegards,\n{{company_name}}',
  updated_at timestamptz not null default now(),
  check (length(quote_subject_template) between 1 and 300),
  check (length(quote_body_template) between 1 and 10000)
);

create table public.crm_quote_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null,
  lead_id uuid,
  account_id uuid not null,
  contact_id uuid,
  opportunity_id uuid,
  quote_reference text not null unique,
  recipient_email text,
  subject text not null,
  body text not null,
  amount numeric(18,2) not null default 0 check(amount >= 0),
  currency text not null default 'INR' check(currency ~ '^[A-Z]{3}$'),
  source_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'Ready to send'
    check(status in ('Needs email','Ready to send','Sending','Sent','Send failed','Cancelled')),
  provider_message_id text,
  sent_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(org_id,id),
  foreign key(org_id,owner_id) references public.org_members(org_id,user_id),
  foreign key(org_id,lead_id) references public.crm_leads(org_id,id),
  foreign key(org_id,account_id) references public.crm_accounts(org_id,id),
  foreign key(org_id,account_id,contact_id) references public.crm_contacts(org_id,account_id,id),
  foreign key(org_id,account_id,opportunity_id) references public.crm_opportunities(org_id,account_id,id)
);
create unique index crm_one_active_quote_draft_per_lead
  on public.crm_quote_drafts(org_id,lead_id) where lead_id is not null and archived_at is null and status <> 'Cancelled';
create index crm_quote_drafts_queue on public.crm_quote_drafts(org_id,status,created_at) where archived_at is null;
create index crm_quote_drafts_customer on public.crm_quote_drafts(org_id,account_id,created_at desc) where archived_at is null;

create table public.crm_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null default 'Email',
  provider_message_id text,
  sender_email text not null,
  subject text,
  body_text text not null,
  quote_draft_id uuid references public.crm_quote_drafts(id) on delete set null,
  lead_id uuid,
  account_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  match_method text not null default 'Unmatched' check(match_method in ('Quote reference','Email','Unmatched')),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(org_id,source,provider_message_id),
  foreign key(org_id,lead_id) references public.crm_leads(org_id,id),
  foreign key(org_id,account_id) references public.crm_accounts(org_id,id),
  foreign key(org_id,account_id,contact_id) references public.crm_contacts(org_id,account_id,id),
  foreign key(org_id,account_id,opportunity_id) references public.crm_opportunities(org_id,account_id,id),
  check(length(body_text) between 1 and 20000)
);
create index crm_inbound_messages_customer on public.crm_inbound_messages(org_id,account_id,received_at desc);

create table public.crm_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null,
  message_id uuid not null references public.crm_inbound_messages(id) on delete cascade,
  lead_id uuid,
  account_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  source text not null check(source in ('Deterministic','Claude Haiku')),
  confidence numeric(4,3) not null check(confidence between 0 and 1),
  summary text not null check(length(summary) between 1 and 1000),
  recommendation jsonb not null default '{}'::jsonb,
  status text not null default 'Pending' check(status in ('Pending','Applied','Dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(message_id),
  foreign key(org_id,owner_id) references public.org_members(org_id,user_id),
  foreign key(org_id,lead_id) references public.crm_leads(org_id,id),
  foreign key(org_id,account_id) references public.crm_accounts(org_id,id),
  foreign key(org_id,account_id,contact_id) references public.crm_contacts(org_id,account_id,id),
  foreign key(org_id,account_id,opportunity_id) references public.crm_opportunities(org_id,account_id,id)
);
create index crm_ai_suggestions_queue on public.crm_ai_suggestions(org_id,status,created_at desc);

create or replace function crm_private.touch_sales_automation_record()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at := now(); return new; end $$;
create trigger touch_crm_sales_automation_settings before update on public.crm_sales_automation_settings for each row execute function crm_private.touch_sales_automation_record();
create trigger touch_crm_quote_drafts before update on public.crm_quote_drafts for each row execute function crm_private.touch_sales_automation_record();

-- A draft is created without AI or an external call. This makes promotion
-- deterministic, fast and safe even when the email provider is unavailable.
create or replace function crm_private.create_sales_quote_draft(p_lead uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare l crm_leads; c crm_contacts; s crm_sales_automation_settings; draft_id uuid;
declare customer_name text; company_name text; product_name text; quoted_amount text;
begin
  select * into l from crm_leads where id=p_lead and archived_at is null for update;
  if not found or l.account_id is null or (l.status not in ('Qualified','Interested','Converted') and l.opportunity_id is null) then return null; end if;
  select * into s from crm_sales_automation_settings where org_id=l.org_id;
  if s.org_id is not null and not s.quotes_enabled then return null; end if;
  select * into c from crm_contacts where id=l.contact_id and org_id=l.org_id and archived_at is null;
  customer_name:=coalesce(nullif(trim(c.first_name||' '||coalesce(c.last_name,'')),''),nullif(trim(l.first_name||' '||coalesce(l.last_name,'')),''),l.name,'Customer');
  company_name:=coalesce(nullif(trim(l.company_name),''),'Qyrova');
  product_name:=coalesce(nullif(trim(l.product),''),'your requested service');
  quoted_amount:=to_char(coalesce(l.estimated_value,0),'FM999G999G999G990D00');
  insert into crm_quote_drafts(org_id,owner_id,lead_id,account_id,contact_id,opportunity_id,quote_reference,recipient_email,subject,body,amount,currency,source_snapshot,status)
  values(
    l.org_id,l.owner_id,l.id,l.account_id,l.contact_id,l.opportunity_id,
    'QYR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
    coalesce(c.email,l.email),
    replace(replace(replace(coalesce(s.quote_subject_template,'Your quotation is ready — {{customer_name}}'),'{{customer_name}}',customer_name),'{{product}}',product_name),'{{amount}}',quoted_amount),
    replace(replace(replace(replace(coalesce(s.quote_body_template,'Hello {{customer_name}},\n\nThank you for your interest in {{product}}. We have prepared your quotation for {{amount}}.\n\nRegards,\n{{company_name}}'),'{{customer_name}}',customer_name),'{{product}}',product_name),'{{amount}}',quoted_amount),'{{company_name}}',company_name),
    coalesce(l.estimated_value,0),'INR',
    jsonb_strip_nulls(jsonb_build_object('lead_name',l.name,'company_name',l.company_name,'email',coalesce(c.email,l.email),'phone',coalesce(c.phone,l.phone),'product',l.product,'estimated_value',l.estimated_value,'custom_fields',l.custom_fields)),
    case when coalesce(c.email,l.email) is null then 'Needs email' else 'Ready to send' end
  ) on conflict do nothing returning id into draft_id;
  if draft_id is not null then
    insert into crm_events(org_id,owner_id,entity_type,entity_id,account_id,lead_id,contact_id,opportunity_id,event_type,title,detail)
    values(l.org_id,l.owner_id,'quote_drafts',draft_id,l.account_id,l.id,l.contact_id,l.opportunity_id,'automated_quote_drafted','Automated quotation draft created','Reference: '||(select quote_reference from crm_quote_drafts where id=draft_id));
  end if;
  return draft_id;
end $$;

create or replace function crm_private.queue_sales_quote_draft()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.archived_at is null and (new.status in ('Qualified','Interested','Converted') or new.opportunity_id is not null) then
    perform crm_private.create_sales_quote_draft(new.id);
  end if;
  return new;
end $$;
drop trigger if exists queue_sales_quote_draft_on_lead on public.crm_leads;
create trigger queue_sales_quote_draft_on_lead
  after insert or update of status,opportunity_id,contact_id,account_id on public.crm_leads
  for each row execute function crm_private.queue_sales_quote_draft();

alter table public.crm_sales_automation_settings enable row level security;
alter table public.crm_quote_drafts enable row level security;
alter table public.crm_inbound_messages enable row level security;
alter table public.crm_ai_suggestions enable row level security;
revoke all on public.crm_sales_automation_settings,public.crm_quote_drafts,public.crm_inbound_messages,public.crm_ai_suggestions from public,anon,authenticated;
grant select,insert,update on public.crm_sales_automation_settings,public.crm_quote_drafts,public.crm_ai_suggestions to authenticated;
grant select on public.crm_inbound_messages to authenticated;
create policy sales_automation_settings_read on public.crm_sales_automation_settings for select to authenticated using(crm_can(org_id,'workflows','view',auth.uid()));
create policy sales_automation_settings_write on public.crm_sales_automation_settings for all to authenticated using(crm_can(org_id,'workflows','edit',auth.uid())) with check(crm_can(org_id,'workflows','edit',auth.uid()));
create policy sales_quote_drafts_read on public.crm_quote_drafts for select to authenticated using(crm_can(org_id,'quotations','view',owner_id));
create policy sales_quote_drafts_write on public.crm_quote_drafts for update to authenticated using(crm_can(org_id,'quotations','edit',owner_id)) with check(crm_can(org_id,'quotations','edit',owner_id));
create policy sales_suggestions_read on public.crm_ai_suggestions for select to authenticated using(crm_can(org_id,'opportunities','view',owner_id));
create policy sales_suggestions_write on public.crm_ai_suggestions for update to authenticated using(crm_can(org_id,'opportunities','edit',owner_id)) with check(crm_can(org_id,'opportunities','edit',owner_id));
create policy sales_inbound_read on public.crm_inbound_messages for select to authenticated using(
  account_id is not null and crm_can(org_id,'accounts','view',(select owner_id from crm_accounts where id=account_id and org_id=crm_inbound_messages.org_id))
);

-- A suggestion is never an automatic record mutation. A human chooses Apply,
-- and this RPC carries out only the narrow, validated action shown in the UI.
create or replace function public.crm_apply_ai_suggestion(p_suggestion uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare s crm_ai_suggestions; action text; title text; due_minutes int; stage_value text;
begin
  select * into s from crm_ai_suggestions where id=p_suggestion for update;
  if not found or s.status <> 'Pending' then raise exception 'Suggestion is unavailable'; end if;
  if not crm_can(s.org_id,'opportunities','edit',s.owner_id) then raise exception 'Opportunity edit permission required'; end if;
  action:=s.recommendation->>'action';
  if action='create_follow_up' then
    title:=coalesce(nullif(left(trim(s.recommendation->>'title'),200),''),'Reply to customer');
    due_minutes:=greatest(0,least(coalesce((s.recommendation->>'due_minutes')::int,60),10080));
    insert into crm_activities(org_id,owner_id,title,activity_type,description,due_at,lead_id,account_id,contact_id,opportunity_id)
    values(s.org_id,s.owner_id,title,'Follow-up',left(coalesce(s.recommendation->>'reason',s.summary),10000),now()+make_interval(mins=>due_minutes),s.lead_id,s.account_id,s.contact_id,s.opportunity_id);
  elsif action='update_stage' then
    stage_value:=s.recommendation->>'stage';
    if stage_value not in ('Qualification','Discovery','Demo/Meeting','Proposal/Quotation','Negotiation','Won','Lost') or s.opportunity_id is null then raise exception 'Invalid suggested stage'; end if;
    update crm_opportunities set stage=stage_value, next_step=left(coalesce(s.recommendation->>'next_step',''),500) where id=s.opportunity_id and org_id=s.org_id;
  elsif action='mark_interested' then
    if s.lead_id is null then raise exception 'No related lead'; end if;
    update crm_leads set status='Interested' where id=s.lead_id and org_id=s.org_id and archived_at is null;
  else raise exception 'Unsupported suggestion'; end if;
  update crm_ai_suggestions set status='Applied',reviewed_by=auth.uid(),reviewed_at=now() where id=s.id;
  return jsonb_build_object('status','Applied','action',action);
end $$;
revoke all on function public.crm_apply_ai_suggestion(uuid) from public,anon;
grant execute on function public.crm_apply_ai_suggestion(uuid) to authenticated;

commit;
