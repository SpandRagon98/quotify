begin;
-- Additive adapter: old quotations, stages, roles, and custom templates survive.
alter table public.crm_quote_links add column if not exists document_kind text not null default 'Quotation' check(document_kind in ('Quotation','Invoice','Proposal'));
alter table public.crm_quote_links add column if not exists sent_at timestamptz;
alter table public.crm_quote_links add column if not exists expires_at timestamptz;
alter table public.crm_quote_links add column if not exists follow_up_created boolean not null default false;
alter table public.crm_opportunities add column if not exists lost_note text;
create table public.crm_journey_settings (
 org_id uuid primary key references public.organizations(id) on delete cascade,
 quote_attention_days int not null default 3 check(quote_attention_days between 1 and 60),
 quote_risk_days int not null default 7 check(quote_risk_days between 2 and 90),
 enquiry_attention_hours int not null default 24 check(enquiry_attention_hours between 1 and 168),
 check(quote_risk_days>quote_attention_days)
);
alter table public.crm_journey_settings enable row level security;
revoke all on public.crm_journey_settings from public,anon;
grant select,insert,update on public.crm_journey_settings to authenticated;
create policy journey_settings_read on public.crm_journey_settings for select to authenticated using(is_org_member(org_id));
create policy journey_settings_write on public.crm_journey_settings for all to authenticated using(org_role(org_id) in ('owner','admin','editor')) with check(org_role(org_id) in ('owner','admin','editor'));
create function public.crm_pulse_status(f jsonb) returns text language plpgsql stable security invoker set search_path=public as $$
declare attention int:=3; risk int:=7; enquiry int:=24; sent timestamptz:=(f->>'quote_sent_at')::timestamptz; reply timestamptz:=(f->>'reply_at')::timestamptz; waiting boolean;
begin
 select coalesce(s.quote_attention_days,3),coalesce(s.quote_risk_days,7),coalesce(s.enquiry_attention_hours,24) into attention,risk,enquiry from (select 1) x left join crm_journey_settings s on s.org_id=(f->>'org_id')::uuid;
 if f->>'stage' in ('Won','Lost') then return 'On Track'; end if;
 waiting:=sent is not null and (reply is null or reply<sent) and coalesce(f->>'quote_status','') not in ('Accepted','Declined','approved','declined');
 if coalesce((f->>'overdue_count')::int,0)>0 or (waiting and ((f->>'quote_expires_at')::timestamptz<=now()+interval '2 days' or sent<now()-make_interval(days=>risk))) then return 'At Risk'; end if;
 if waiting and sent<now()-make_interval(days=>attention) then return 'Needs Attention'; end if;
 if reply is not null and (sent is null or reply>=sent) and reply>now()-interval '3 days' then return 'On Track'; end if;
 if f->>'meeting_at' is not null and f->>'next_due_at' is null then return 'Needs Attention'; end if;
 if coalesce(f->>'stage','Qualification')='Qualification' and f->>'last_contacted_at' is null and (f->>'created_at')::timestamptz<now()-make_interval(hours=>enquiry) then return 'Needs Attention'; end if;
 if f->>'stage' in ('Demo/Meeting','Discovery') and sent is null then return 'On Track'; end if;
 if f->>'next_due_at' is null then return 'Needs Attention'; end if;
 return 'On Track';
end $$;
revoke all on function public.crm_pulse_status(jsonb) from public,anon;
grant execute on function public.crm_pulse_status(jsonb) to authenticated;

create view public.crm_journey_deals with (security_invoker=true) as
select facts.*,public.crm_pulse_status(to_jsonb(facts)) as pulse_status from (
select o.*, a.name as company_name, concat_ws(' ',c.first_name,c.last_name) as customer_name,
 coalesce(c.email,a.email) as email,coalesce(c.phone,a.phone) as phone,
 q.id as quote_id,q.quotation_id,q.preset_id,q.preset_name,q.status as quote_status,q.sent_at as quote_sent_at,q.expires_at as quote_expires_at,
 t.next_due_at,t.next_title,t.next_id,t.overdue_count,m.meeting_at,r.reply_at,e.last_activity_at,
 greatest((select max(last_contacted_at) from crm_leads where account_id=o.account_id and org_id=o.org_id and archived_at is null),(select max(completed_at) from crm_activities where org_id=o.org_id and opportunity_id=o.id and archived_at is null and status='Completed' and activity_type in ('Call','Meeting','Email'))) as last_contacted_at
from crm_opportunities o
left join crm_accounts a on a.id=o.account_id and a.org_id=o.org_id and a.archived_at is null
left join lateral (select * from crm_contacts where account_id=o.account_id and org_id=o.org_id and archived_at is null and (o.contact_id is null or id=o.contact_id) order by is_primary desc,created_at limit 1) c on true
left join lateral (select * from crm_quote_links where opportunity_id=o.id and org_id=o.org_id and archived_at is null and document_kind='Quotation' order by created_at desc limit 1) q on true
left join lateral (select min(due_at) as next_due_at,(array_agg(title order by due_at nulls last))[1] as next_title,(array_agg(id order by due_at nulls last))[1] as next_id,count(*) filter(where due_at<now())::int as overdue_count from crm_activities where opportunity_id=o.id and org_id=o.org_id and archived_at is null and status not in ('Completed','Cancelled')) t on true
left join lateral (select max(completed_at) as meeting_at from crm_activities where opportunity_id=o.id and org_id=o.org_id and archived_at is null and activity_type='Meeting' and status='Completed') m on true
left join lateral (select max(at) as reply_at from (select received_at as at from crm_inbound_messages where opportunity_id=o.id and org_id=o.org_id union all select completed_at from crm_activities where opportunity_id=o.id and org_id=o.org_id and archived_at is null and activity_type='Email' and outcome='Received') responses) r on true
left join lateral (select max(created_at) as last_activity_at from crm_events where opportunity_id=o.id and org_id=o.org_id) e on true
where o.archived_at is null) facts;

create view public.crm_journey_customers with (security_invoker=true) as
select facts.*,public.crm_pulse_status(to_jsonb(facts)) as pulse_status from (
select a.*,coalesce(nullif(concat_ws(' ',c.first_name,c.last_name),''),a.name) as customer_name,c.id as contact_id,
 coalesce(c.email,a.email) as customer_email,coalesce(c.phone,a.phone) as customer_phone,
 o.id as opportunity_id,o.name as deal_name,coalesce(o.amount,0) as amount,coalesce(o.currency,'INR') as currency,
 coalesce(o.stage,case when l.status in ('Contacted','Attempted Contact') then 'Discovery' when l.status in ('Qualified','Interested') then 'Demo/Meeting' else 'Qualification' end) as stage,
 l.id as lead_id,greatest(l.last_contacted_at,(select max(completed_at) from crm_activities where org_id=a.org_id and account_id=a.id and archived_at is null and status='Completed' and activity_type in ('Call','Meeting','Email'))) as last_contacted_at,
 case when o.id is not null then o.quote_id else q.id end as quote_id,case when o.id is not null then o.quotation_id else q.quotation_id end as quotation_id,
 case when o.id is not null then o.preset_id else q.preset_id end as preset_id,case when o.id is not null then o.preset_name else q.preset_name end as preset_name,
 case when o.id is not null then o.quote_status else q.status end as quote_status,case when o.id is not null then o.quote_sent_at else q.sent_at end as quote_sent_at,case when o.id is not null then o.quote_expires_at else q.expires_at end as quote_expires_at,
 t.next_due_at,t.next_title,t.next_id,t.overdue_count,m.meeting_at,case when o.id is not null then o.reply_at else r.reply_at end as reply_at,e.last_activity_at
from crm_accounts a
left join lateral (select * from crm_contacts where account_id=a.id and org_id=a.org_id and archived_at is null order by is_primary desc,created_at limit 1) c on true
left join lateral (select * from crm_journey_deals where account_id=a.id and org_id=a.org_id order by (stage not in ('Won','Lost')) desc,case pulse_status when 'At Risk' then 2 when 'Needs Attention' then 1 else 0 end desc,created_at desc limit 1) o on true
left join lateral (select * from crm_leads where account_id=a.id and org_id=a.org_id and archived_at is null order by created_at desc limit 1) l on true
left join lateral (select * from crm_quote_links where account_id=a.id and org_id=a.org_id and archived_at is null and document_kind='Quotation' order by created_at desc limit 1) q on true
left join lateral (select min(due_at) as next_due_at,(array_agg(title order by due_at nulls last))[1] as next_title,(array_agg(id order by due_at nulls last))[1] as next_id,count(*) filter(where due_at<now())::int as overdue_count from crm_activities where account_id=a.id and org_id=a.org_id and archived_at is null and status not in ('Completed','Cancelled')) t on true
left join lateral (select max(completed_at) as meeting_at from crm_activities where account_id=a.id and org_id=a.org_id and archived_at is null and activity_type='Meeting' and status='Completed') m on true
left join lateral (select max(at) as reply_at from (select received_at as at from crm_inbound_messages where account_id=a.id and org_id=a.org_id union all select completed_at from crm_activities where account_id=a.id and org_id=a.org_id and archived_at is null and activity_type='Email' and outcome='Received') responses) r on true
left join lateral (select max(created_at) as last_activity_at from crm_events where account_id=a.id and org_id=a.org_id) e on true
where a.archived_at is null) facts;
revoke all on public.crm_journey_deals,public.crm_journey_customers from public,anon;
grant select on public.crm_journey_deals,public.crm_journey_customers to authenticated;
create view public.crm_journey_documents with (security_invoker=true) as
 select q.*,a.name as company_name,concat_ws(' ',c.first_name,c.last_name) as customer_name,
 (q.sent_at is not null and q.status not in ('Accepted','Declined','Approved') and not exists(select 1 from crm_inbound_messages r where r.org_id=q.org_id and r.received_at>=q.sent_at and (r.opportunity_id=q.opportunity_id or (q.opportunity_id is null and r.account_id=q.account_id))) and not exists(select 1 from crm_activities r where r.org_id=q.org_id and r.archived_at is null and r.activity_type='Email' and r.outcome='Received' and r.status='Completed' and r.completed_at>=q.sent_at and (r.opportunity_id=q.opportunity_id or (q.opportunity_id is null and r.account_id=q.account_id)))) as awaiting_reply
 from crm_quote_links q left join crm_accounts a on a.id=q.account_id and a.org_id=q.org_id and a.archived_at is null left join crm_contacts c on c.id=q.contact_id and c.org_id=q.org_id and c.archived_at is null where q.archived_at is null;
create view public.crm_journey_contacts with (security_invoker=true) as
 select c.*,concat_ws(' ',c.first_name,c.last_name) as customer_name,a.name as company_name from crm_contacts c left join crm_accounts a on a.id=c.account_id and a.org_id=c.org_id and a.archived_at is null where c.archived_at is null;
create view public.crm_journey_tasks with (security_invoker=true) as
 select t.*,a.name as company_name,concat_ws(' ',c.first_name,c.last_name) as customer_name,o.amount,o.currency,o.pulse_status,o.quote_sent_at,o.quote_status,o.quote_expires_at,o.reply_at,o.overdue_count,o.stage from crm_activities t left join crm_accounts a on a.id=t.account_id and a.org_id=t.org_id and a.archived_at is null left join crm_contacts c on c.id=t.contact_id and c.org_id=t.org_id and c.archived_at is null left join crm_journey_deals o on o.id=t.opportunity_id and o.org_id=t.org_id where t.archived_at is null;
revoke all on public.crm_journey_documents,public.crm_journey_tasks,public.crm_journey_contacts from public,anon;
grant select on public.crm_journey_documents,public.crm_journey_tasks,public.crm_journey_contacts to authenticated;
create index crm_journey_quote_deal on public.crm_quote_links(org_id,opportunity_id,created_at desc) where archived_at is null;
create index crm_journey_activity_deal on public.crm_activities(org_id,opportunity_id,due_at) where archived_at is null;
create index crm_journey_events_deal on public.crm_events(org_id,opportunity_id,created_at desc);
create index crm_journey_reply_deal on public.crm_inbound_messages(org_id,opportunity_id,received_at desc);

create function public.crm_journey_home(p_org uuid,p_day_start timestamptz,p_day_end timestamptz,p_currency text default 'INR',p_month_start timestamptz default null) returns jsonb language sql stable security invoker set search_path=public as $$
select jsonb_build_object(
 'pipeline',(select coalesce(sum(amount),0) from crm_opportunities where org_id=p_org and archived_at is null and stage not in ('Won','Lost') and currency=p_currency),
 'needs_attention',(select count(*) from crm_journey_deals where org_id=p_org and pulse_status<>'On Track'),
 'followups_due',(select count(*) from crm_activities where org_id=p_org and owner_id=auth.uid() and archived_at is null and status not in ('Completed','Cancelled') and due_at<p_day_end),
 'quotes_waiting',(select count(*) from crm_quote_links q where q.org_id=p_org and q.archived_at is null and q.document_kind='Quotation' and q.sent_at is not null and q.status not in ('Accepted','Declined','Approved') and not exists(select 1 from crm_inbound_messages r where r.org_id=q.org_id and r.received_at>=q.sent_at and (r.opportunity_id=q.opportunity_id or (q.opportunity_id is null and r.account_id=q.account_id))) and not exists(select 1 from crm_activities r where r.org_id=q.org_id and r.archived_at is null and r.activity_type='Email' and r.outcome='Received' and r.status='Completed' and r.completed_at>=q.sent_at and (r.opportunity_id=q.opportunity_id or (q.opportunity_id is null and r.account_id=q.account_id)))),
 'customers',(select coalesce(jsonb_agg(to_jsonb(x)-'search'),'[]') from (select * from crm_journey_customers where org_id=p_org order by case pulse_status when 'At Risk' then 2 when 'Needs Attention' then 1 else 0 end desc,overdue_count desc,quote_sent_at asc nulls last,created_at desc limit 60) x),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(x)-'search'),'[]') from (select * from crm_activities where org_id=p_org and owner_id=auth.uid() and archived_at is null and status not in ('Completed','Cancelled') and due_at<p_day_end order by due_at limit 25) x),
 'won_month',(select coalesce(sum(amount),0) from crm_opportunities where org_id=p_org and archived_at is null and stage='Won' and currency=p_currency and closed_at>=coalesce(p_month_start,date_trunc('month',p_day_start))),
 'average_close_days',(select round(avg(extract(epoch from closed_at-created_at)/86400),1) from crm_opportunities where org_id=p_org and archived_at is null and stage='Won'),
 'enquiries',(select count(*) from crm_leads where org_id=p_org and archived_at is null),
 'won_leads',(select count(distinct l.id) from crm_leads l join crm_opportunities o on o.id=coalesce(l.opportunity_id,l.converted_opportunity_id) and o.org_id=l.org_id where l.org_id=p_org and l.archived_at is null and o.archived_at is null and o.stage='Won'),
 'stages',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select stage,count(*) as count from crm_opportunities where org_id=p_org and archived_at is null group by stage) x),
 'lost_reasons',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select coalesce(lost_reason,'Other') as reason,count(*) as count from crm_opportunities where org_id=p_org and archived_at is null and stage='Lost' group by lost_reason order by count(*) desc limit 10) x)
);
$$;

-- One atomic capture: no partial customer/deal if the final write fails.
create function public.crm_quick_capture(p_org uuid,p_data jsonb,p_create_deal boolean default true) returns jsonb language plpgsql security invoker set search_path=public as $$
declare l crm_leads; o crm_opportunities; capture_notes text:=concat_ws(E'\n',nullif(p_data->>'notes',''),case when nullif(p_data->>'timeline','') is not null then 'Timeline: '||(p_data->>'timeline') end);
begin
 if not is_org_member(p_org) or not crm_can(p_org,'leads','create',auth.uid()) then raise exception 'Enquiry create permission required'; end if;
 if length(p_data::text)>12000 then raise exception 'Please shorten this capture'; end if;
 if exists(select 1 from crm_leads where org_id=p_org and archived_at is null and ((nullif(p_data->>'email','') is not null and lower(email)=lower(p_data->>'email')) or (nullif(p_data->>'phone','') is not null and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_data->>'phone','[^0-9]','','g')))) then raise exception 'A customer enquiry already uses this email or phone. Find it with search to add the deal.'; end if;
 insert into crm_leads(org_id,owner_id,name,first_name,company_name,email,phone,product,estimated_value,notes,source)
 values(p_org,auth.uid(),p_data->>'name',p_data->>'name',nullif(p_data->>'company_name',''),nullif(p_data->>'email',''),nullif(p_data->>'phone',''),p_data->>'product',coalesce(nullif(p_data->>'estimated_value','')::numeric,0),capture_notes,'Quick capture') returning * into l;
 select * into l from crm_leads where id=l.id and org_id=p_org;
 if p_create_deal then
  insert into crm_opportunities(org_id,owner_id,account_id,contact_id,name,amount,source,next_step,description)
  values(p_org,auth.uid(),l.account_id,l.contact_id,coalesce(nullif(p_data->>'product',''),l.name||' enquiry'),l.estimated_value,'Quick capture',p_data->>'next_action',capture_notes) returning * into o;
  update crm_leads set opportunity_id=o.id where id=l.id and org_id=p_org;
 end if;
 return jsonb_build_object('lead_id',l.id,'account_id',l.account_id,'contact_id',l.contact_id,'opportunity_id',o.id);
end $$;

create or replace function public.crm_log_quote_email(p_org uuid,p_quotation text,p_preset text,p_recipient text)
returns void language plpgsql security definer set search_path=public as $$
declare q crm_quote_links;
begin
 if not is_org_member(p_org) then raise exception 'Workspace membership required'; end if;
 if p_recipient is null or length(p_recipient)>320 or p_recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid recipient'; end if;
 select * into q from crm_quote_links where org_id=p_org and quotation_id=p_quotation and preset_id=p_preset and archived_at is null;
 if not found then return; end if;
 if not crm_can(p_org,'quotations','edit',q.owner_id) then raise exception 'Quotation access required'; end if;
 update crm_quote_links set sent_at=now(),status=case when status in ('Accepted','Declined') then status else 'Sent' end where id=q.id;
 insert into crm_events(org_id,owner_id,entity_type,entity_id,account_id,contact_id,opportunity_id,lead_id,event_type,title,detail,actor_id)
 values(q.org_id,q.owner_id,'quote_links',q.id,q.account_id,q.contact_id,q.opportunity_id,q.lead_id,'quote_email_reported',q.document_kind||' '||q.quotation_id||' sent','Recipient: '||lower(trim(p_recipient)),auth.uid());
end $$;

create function crm_private.journey_quote_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.archived_at is not null or new.document_kind<>'Quotation' then return new; end if;
 if new.sent_at is not null and not new.follow_up_created and new.status not in ('Accepted','Declined') and not exists(select 1 from crm_opportunities where id=new.opportunity_id and org_id=new.org_id and stage in ('Won','Lost')) then
  if new.opportunity_id is not null then update crm_opportunities set stage='Proposal/Quotation',next_step='Follow up on '||new.quotation_id where org_id=new.org_id and id=new.opportunity_id and archived_at is null and stage in ('Qualification','Discovery','Demo/Meeting'); end if;
  insert into crm_activities(org_id,owner_id,account_id,contact_id,opportunity_id,lead_id,title,activity_type,due_at,priority,description,created_by)
  values(new.org_id,new.owner_id,new.account_id,new.contact_id,new.opportunity_id,new.lead_id,'Follow up on '||new.quotation_id,'Follow-up',new.sent_at+interval '3 days','Normal','Ask whether the customer needs any changes to the quotation.',new.owner_id);
  update crm_quote_links set follow_up_created=true where id=new.id;
 end if;
 if new.status='Accepted' and (tg_op='INSERT' or old.status is distinct from new.status) then
  update crm_opportunities set stage='Won',next_step='Create invoice or schedule kickoff' where org_id=new.org_id and id=new.opportunity_id and archived_at is null;
  update crm_activities set status='Completed',outcome='Quotation accepted' where org_id=new.org_id and opportunity_id=new.opportunity_id and activity_type='Follow-up' and title='Follow up on '||new.quotation_id and status not in ('Completed','Cancelled');
 end if;
 return new;
end $$;
create trigger journey_quote_event after insert or update of sent_at,status on public.crm_quote_links for each row execute function crm_private.journey_quote_event();

-- A manually closed deal must not keep asking for a quotation follow-up.
-- Delivery tasks, calls and meetings are deliberately left alone.
create function crm_private.journey_deal_closed() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.stage in ('Won','Lost') and old.stage is distinct from new.stage then
  update crm_activities set status=case when new.stage='Won' then 'Completed' else 'Cancelled' end,outcome='Deal '||new.stage
  where org_id=new.org_id and opportunity_id=new.id and archived_at is null and activity_type='Follow-up' and title like 'Follow up on %' and status not in ('Completed','Cancelled');
 end if;
 return new;
end $$;
create trigger journey_deal_closed after update of stage on public.crm_opportunities for each row execute function crm_private.journey_deal_closed();

create function crm_private.journey_tracked_response() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.superseded or exists(select 1 from tracked_quotes where org_id=new.org_id and quotation_id=new.quotation_id and version>new.version) then return new; end if;
 update crm_quote_links set expires_at=new.expires_at,status=case new.status when 'approved' then 'Accepted' when 'declined' then 'Declined' when 'negotiate' then 'Changes requested' when 'expired' then 'Expired' else status end
 where org_id=new.org_id and quotation_id=new.quotation_id and archived_at is null;
 return new;
end $$;
create trigger journey_tracked_response after insert or update of status,expires_at on public.tracked_quotes for each row execute function crm_private.journey_tracked_response();

-- Adapt the existing automatic-quotation queue to the same journey. Sending
-- remains with the existing server provider; this trigger never sends email.
create function crm_private.journey_automated_quote() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.archived_at is not null or new.status<>'Sent' or new.sent_at is null then return new; end if;
 insert into crm_quote_links(org_id,owner_id,account_id,contact_id,opportunity_id,lead_id,preset_id,preset_name,quotation_id,amount,currency,sent_at,status,values_snapshot)
 values(new.org_id,new.owner_id,new.account_id,new.contact_id,new.opportunity_id,new.lead_id,'automated','Automated quotation',new.quote_reference,new.amount,new.currency,new.sent_at,'Sent',
 jsonb_build_object('__journey',jsonb_build_object('kind','Quotation','company','','customer_name',coalesce(new.source_snapshot->>'lead_name','Customer'),'company_name',coalesce(new.source_snapshot->>'company_name',''),'email',new.recipient_email,'created_at',new.created_at,'currency',new.currency,'tax_percent',0,'terms',new.body,'items',jsonb_build_array(jsonb_build_object('name',coalesce(new.source_snapshot->>'product','Requested service'),'quantity',1,'price',new.amount,'discount',0)),'totals',jsonb_build_object('subtotal',new.amount,'discount',0,'tax',0,'total',new.amount))))
 on conflict(org_id,preset_id,quotation_id) do nothing;
 return new;
end $$;
create trigger journey_automated_quote after insert or update of status,sent_at on public.crm_quote_drafts for each row execute function crm_private.journey_automated_quote();

create function crm_private.journey_customer_reply() returns trigger language plpgsql security definer set search_path=public as $$
declare d jsonb:=to_jsonb(new); org uuid:=new.org_id; acct uuid:=(d->>'account_id')::uuid; opp uuid:=(d->>'opportunity_id')::uuid;
begin
 if tg_table_name='crm_activities' and (d->>'activity_type' is distinct from 'Email' or d->>'outcome' is distinct from 'Received' or d->>'status' is distinct from 'Completed') then return new; end if;
 update crm_activities set status='Completed',outcome='Customer responded' where org_id=org and archived_at is null and activity_type='Follow-up' and title like 'Follow up on %' and status not in ('Completed','Cancelled') and ((opp is not null and opportunity_id=opp) or (opp is null and acct is not null and account_id=acct));
 return new;
end $$;
create trigger journey_inbound_reply after insert on public.crm_inbound_messages for each row execute function crm_private.journey_customer_reply();
create trigger journey_logged_reply after insert or update of outcome,status on public.crm_activities for each row execute function crm_private.journey_customer_reply();

-- Normalize the existing status bridge at its source: public responses must not
-- briefly reopen a won deal by mapping an old version to the newest document.
create or replace function crm_private.quote_tracking_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.superseded or exists(select 1 from tracked_quotes where org_id=new.org_id and thread_id=new.thread_id and version>new.version) then return new; end if;
 update crm_quote_links set status=case new.status when 'approved' then 'Accepted' when 'declined' then 'Declined' when 'negotiate' then 'Changes requested' when 'viewed' then case when sent_at is null then status else 'Viewed' end else status end where org_id=new.org_id and quotation_id=new.quotation_id and preset_name=new.preset_name and archived_at is null;
 return new;
end $$;

-- Follow-ups use the existing delivery integration, then record a separate email
-- activity. Recording a follow-up never resets the original quote-sent date.
create function public.crm_record_followup(p_org uuid,p_account uuid,p_opportunity uuid,p_subject text,p_body text,p_recipient text) returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
 if length(p_subject)>300 or length(p_body)>10000 then raise exception 'Message too long'; end if;
 insert into crm_activities(org_id,owner_id,account_id,opportunity_id,title,activity_type,status,description,outcome)
 values(p_org,auth.uid(),p_account,p_opportunity,p_subject,'Email','Completed',p_body,'Sent to '||p_recipient) returning id into result;
 return result;
end $$;
revoke all on function public.crm_journey_home(uuid,timestamptz,timestamptz,text,timestamptz),public.crm_quick_capture(uuid,jsonb,boolean),public.crm_record_followup(uuid,uuid,uuid,text,text,text) from public,anon;
grant execute on function public.crm_journey_home(uuid,timestamptz,timestamptz,text,timestamptz),public.crm_quick_capture(uuid,jsonb,boolean),public.crm_record_followup(uuid,uuid,uuid,text,text,text) to authenticated;
-- Record meaningful contact, but never turn notes or pending tasks into calls.
create function crm_private.journey_contacted() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.archived_at is not null or new.status<>'Completed' or new.activity_type not in ('Call','Meeting','Email') then return new; end if;
 update crm_leads set last_contacted_at=greatest(last_contacted_at,new.completed_at),status=case when status in ('New','Attempted Contact') then 'Contacted' else status end where org_id=new.org_id and archived_at is null and ((new.lead_id is not null and id=new.lead_id) or (new.lead_id is null and account_id=new.account_id));
 update crm_opportunities set stage='Discovery' where org_id=new.org_id and archived_at is null and stage='Qualification' and id=new.opportunity_id;
 return new;
end $$;
create trigger journey_contacted after insert or update of status,outcome on public.crm_activities for each row execute function crm_private.journey_contacted();
-- Only verified email-history events seed sent dates. Creating a public link
-- does not prove an email was sent, so tracked link dates are not backfilled.
update crm_quote_links set status='Accepted' where status='Approved' and archived_at is null;
update crm_quote_links q set sent_at=e.sent_at from (select entity_id,min(created_at) as sent_at from crm_events where event_type='quote_email_reported' group by entity_id) e where q.id=e.entity_id and q.sent_at is null and q.archived_at is null;
update crm_quote_drafts set status=status where status='Sent' and sent_at is not null and archived_at is null;
commit;
