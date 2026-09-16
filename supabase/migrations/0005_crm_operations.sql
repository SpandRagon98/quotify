begin;
-- RLS remains active inside ordinary RPCs. Conversion is atomic and idempotent.
create function public.crm_convert_lead(p_lead uuid,p_account uuid default null,p_create_opportunity boolean default true,p_confirm_duplicate boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare l crm_leads; a crm_accounts; c crm_contacts; o crm_opportunities; duplicate_count int; previous_flag text;
begin
 select * into l from crm_leads where id=p_lead and archived_at is null for update;
 if not found or not crm_can(l.org_id,'leads','edit',l.owner_id) then raise exception 'Lead is unavailable or conversion not permitted'; end if;
 if l.converted_at is not null then return jsonb_build_object('account_id',l.converted_account_id,'contact_id',l.converted_contact_id,'opportunity_id',l.converted_opportunity_id,'already',true); end if;
 if not crm_can(l.org_id,'accounts','create',l.owner_id) or not crm_can(l.org_id,'contacts','create',l.owner_id) then raise exception 'Account and contact creation permission required'; end if;
 if p_account is not null then
  select * into a from crm_accounts where id=p_account and org_id=l.org_id and archived_at is null;
  if not found then raise exception 'Account unavailable'; end if;
 else
  if nullif(trim(l.company_name),'') is null then raise exception 'Add a company name before converting this B2B lead'; end if;
  select count(*) into duplicate_count from crm_accounts where org_id=l.org_id and lower(trim(name))=lower(trim(l.company_name)) and archived_at is null;
  if duplicate_count>0 and not p_confirm_duplicate then raise exception 'An account with this name exists. Select it or explicitly confirm creating another.'; end if;
  insert into crm_accounts(org_id,owner_id,name,industry,website,phone,email,city,state,country,pincode,tags,notes)
   values(l.org_id,l.owner_id,l.company_name,l.industry,l.website,l.phone,l.email,l.city,l.state,l.country,l.pincode,l.tags,l.notes) returning * into a;
 end if;
 -- Only exact contact matches in the selected account are reused; no data is overwritten.
 select * into c from crm_contacts where org_id=l.org_id and account_id=a.id and archived_at is null
  and ((l.email is not null and lower(email)=lower(l.email)) or (nullif(regexp_replace(l.phone,'[^0-9]','','g'),'') is not null and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(l.phone,'[^0-9]','','g'))) limit 1;
 if c.id is null then
  insert into crm_contacts(org_id,owner_id,account_id,first_name,last_name,designation,email,phone,alternate_phone,is_primary,notes)
   values(l.org_id,l.owner_id,a.id,coalesce(nullif(trim(l.first_name),''),l.name),l.last_name,l.designation,l.email,l.phone,l.alternate_phone,
    not exists(select 1 from crm_contacts where account_id=a.id and org_id=l.org_id and is_primary and archived_at is null),l.notes) returning * into c;
 end if;
 if p_create_opportunity then
  insert into crm_opportunities(org_id,owner_id,account_id,contact_id,name,amount,source,product,description)
   values(l.org_id,l.owner_id,a.id,c.id,l.name || ' opportunity',l.estimated_value,l.source,l.product,l.notes) returning * into o;
 end if;
 previous_flag:=current_setting('qyrova.converting',true);
 perform set_config('qyrova.converting','on',true);
 update crm_leads set status='Converted',converted_at=now(),converted_account_id=a.id,converted_contact_id=c.id,converted_opportunity_id=o.id where id=l.id;
 perform set_config('qyrova.converting',coalesce(previous_flag,''),true);
 -- Existing follow-ups now also appear in Customer 360, preserving their lead relationship.
 update crm_activities set account_id=a.id,contact_id=c.id,opportunity_id=o.id where org_id=l.org_id and lead_id=l.id and archived_at is null;
 return jsonb_build_object('account_id',a.id,'contact_id',c.id,'opportunity_id',o.id);
end $$;

create function public.crm_duplicates(p_org uuid,p_email text default null,p_phone text default null,p_company text default null,p_name text default null)
returns setof public.crm_leads language sql stable security invoker set search_path=public as $$
 select * from crm_leads where org_id=p_org and archived_at is null and (
  (nullif(trim(p_email),'') is not null and lower(email)=lower(trim(p_email))) or
  (nullif(regexp_replace(p_phone,'[^0-9]','','g'),'') is not null and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g')) or
  (nullif(trim(p_company),'') is not null and lower(trim(company_name))=lower(trim(p_company)) and lower(trim(name))=lower(trim(p_name))))
 order by created_at desc limit 20;
$$;

create function public.crm_accept_inbox(p_entry uuid,p_merge_lead uuid default null,p_confirm_merge boolean default false)
returns uuid language plpgsql security invoker set search_path=public as $$
declare i crm_inbox; l crm_leads; duplicate_count int;
begin
 select * into i from crm_inbox where id=p_entry and archived_at is null for update;
 if not found or not crm_can(i.org_id,'inbox','edit',i.owner_id) then raise exception 'Inbox entry unavailable'; end if;
 if i.lead_id is not null then return i.lead_id; end if;
 if i.status not in ('New') then raise exception 'Only unprocessed enquiries can be accepted'; end if;
 if p_merge_lead is not null then
  if not p_confirm_merge then raise exception 'Explicit merge confirmation required'; end if;
  select * into l from crm_leads where id=p_merge_lead and org_id=i.org_id and archived_at is null for update;
  if not found or not crm_can(i.org_id,'leads','edit',l.owner_id) then raise exception 'Merge target unavailable'; end if;
  -- Preserve target fields; append the enquiry instead of silently replacing them.
  update crm_leads set notes=concat_ws(E'\n',notes,'Merged enquiry ('||i.source||'): '||coalesce(i.mapped_fields->>'notes',i.name)) where id=l.id;
  update crm_inbox set lead_id=l.id,status='Merged' where id=i.id;
 else
  select count(*) into duplicate_count from crm_duplicates(i.org_id,i.email,i.phone,i.company_name,i.name);
  if duplicate_count>0 and not p_confirm_merge then raise exception 'Potential duplicate found. Review and confirm merge or creating a separate lead.'; end if;
  insert into crm_leads(org_id,owner_id,name,company_name,first_name,last_name,email,phone,source,product,notes,city,state,country)
  values(i.org_id,i.owner_id,i.name,i.company_name,i.mapped_fields->>'first_name',i.mapped_fields->>'last_name',i.email,i.phone,i.source,i.mapped_fields->>'product',i.mapped_fields->>'notes',i.mapped_fields->>'city',i.mapped_fields->>'state',i.mapped_fields->>'country') returning * into l;
  update crm_inbox set lead_id=l.id,status='Accepted' where id=i.id;
 end if;
 return l.id;
end $$;

create function public.crm_ingest(p_org uuid,p_source text,p_entries jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare e jsonb; accepted int:=0; conflicts int:=0; inserted uuid;
begin
 if not crm_can(p_org,'inbox','create',auth.uid()) then raise exception 'Ingestion permission required'; end if;
 if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 1 and 100 then raise exception 'Import 1–100 entries per batch'; end if;
 if length(trim(p_source)) not between 1 and 120 then raise exception 'Invalid source'; end if;
 for e in select value from jsonb_array_elements(p_entries) loop
  inserted:=null;
  insert into crm_inbox(org_id,owner_id,source,source_identifier,source_timestamp,raw_payload,mapped_fields,name,company_name,phone,email)
   values(p_org,auth.uid(),p_source,nullif(e->>'source_identifier',''),nullif(e->>'source_timestamp','')::timestamptz,
    coalesce(e->'raw_payload',e),coalesce(e->'mapped_fields',e),e->>'name',e->>'company_name',e->>'phone',nullif(e->>'email',''))
   on conflict(org_id,source,source_identifier) where source_identifier is not null do nothing returning id into inserted;
  if inserted is null then conflicts:=conflicts+1; else accepted:=accepted+1; end if;
 end loop;
 return jsonb_build_object('accepted',accepted,'duplicates_skipped',conflicts);
end $$;

create function public.crm_members(p_org uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not is_org_member(p_org) then raise exception 'Workspace membership required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.full_name,'Member'),'email',case when org_role(p_org) in ('owner','admin') or m.user_id=auth.uid() then u.email else null end,'role',m.role,'team_id',m.team_id)), '[]') from org_members m left join profiles p on p.id=m.user_id left join auth.users u on u.id=m.user_id where m.org_id=p_org);
end $$;
create function public.crm_set_member(p_org uuid,p_email text,p_role text,p_team uuid default null,p_remove boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare target uuid; current_role text;
begin
 if org_role(p_org) not in ('owner','admin') or org_role(p_org) is null then raise exception 'Admin access required'; end if;
 if p_role not in ('admin','editor','doc_viewer','sales_manager','sales_user','finance','viewer') then raise exception 'Invalid assignable role'; end if;
 select id into target from auth.users where lower(email)=lower(trim(p_email));
 if target is null then raise exception 'This person must sign up to Qyrova first. This action does not send an invitation email.'; end if;
 select role into current_role from org_members where org_id=p_org and user_id=target;
 if current_role='owner' or target=auth.uid() then raise exception 'Cannot change the Owner or your own access'; end if;
 if p_team is not null and not exists(select 1 from crm_teams where org_id=p_org and id=p_team) then raise exception 'Invalid team'; end if;
 if p_remove then
  -- FK constraints prevent orphaning their CRM records. Reassign before removing.
  delete from org_members where org_id=p_org and user_id=target;
 else
  insert into org_members(org_id,user_id,role,team_id) values(p_org,target,p_role,p_team)
   on conflict(org_id,user_id) do update set role=excluded.role,team_id=excluded.team_id;
 end if;
end $$;
create function public.crm_create_team(p_org uuid,p_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not crm_can(p_org,'users','edit',auth.uid()) then raise exception 'Admin access required'; end if;
 insert into crm_teams(org_id,name) values(p_org,trim(p_name)) returning id into result;
 return result;
end $$;
create function public.crm_workspaces() returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'role',m.role)), '[]') from organizations o join org_members m on m.org_id=o.id where m.user_id=auth.uid();
$$;
create function public.crm_switch_workspace(p_org uuid) returns void language plpgsql security invoker set search_path=public as $$
begin
 if not is_org_member(p_org) then raise exception 'Workspace unavailable'; end if;
 update profiles set default_org_id=p_org where id=auth.uid();
end $$;

-- One server definition for metrics, pipeline totals and reports; RLS scopes every row.
create function public.crm_metrics(p_org uuid,p_from timestamptz default null,p_to timestamptz default null,p_owner uuid default null,p_team uuid default null,p_source text default null,p_stage text default null,p_currency text default 'INR',p_query text default null)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 if not crm_can(p_org,'reports','view',auth.uid()) then raise exception 'Report access required'; end if;
 if p_from is not null and p_to is not null and p_from>=p_to then raise exception 'Invalid date range'; end if;
 with l as (
  select * from crm_leads where org_id=p_org and archived_at is null and (p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to)
  and (p_owner is null or owner_id=p_owner) and (p_source is null or source=p_source) and (p_team is null or owner_id in(select user_id from org_members where org_id=p_org and team_id=p_team))
 ), o as (
  select * from crm_opportunities where org_id=p_org and archived_at is null and currency=p_currency and (p_owner is null or owner_id=p_owner) and (p_source is null or source=p_source) and (p_stage is null or stage=p_stage)
  and (nullif(trim(p_query),'') is null or search @@ websearch_to_tsquery('simple',p_query))
  and (p_team is null or owner_id in(select user_id from org_members where org_id=p_org and team_id=p_team))
 ), a as (
  select * from crm_activities where org_id=p_org and archived_at is null and (p_owner is null or owner_id=p_owner)
  and (p_team is null or owner_id in(select user_id from org_members where org_id=p_org and team_id=p_team))
  and (p_source is null or lead_id in(select id from crm_leads where org_id=p_org and source=p_source) or opportunity_id in(select id from o))
  and (p_stage is null or opportunity_id in(select id from o))
 ), q as (
  select * from crm_quote_links where org_id=p_org and archived_at is null and currency=p_currency and (p_owner is null or owner_id=p_owner)
   and (p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to)
   and (p_team is null or owner_id in(select user_id from org_members where org_id=p_org and team_id=p_team))
   and (p_source is null or lead_id in(select id from crm_leads where org_id=p_org and source=p_source) or opportunity_id in(select id from o))
   and (p_stage is null or opportunity_id in(select id from o))
 ), window_o as (
  select * from o where (p_from is null or coalesce(closed_at,created_at)>=p_from) and (p_to is null or coalesce(closed_at,created_at)<p_to)
 )
 select jsonb_build_object(
  'leads',(select count(*) from l),'new_leads',(select count(*) from l where status='New'),
  'qualified_leads',(select count(*) from l where status in ('Qualified','Converted')),'converted_leads',(select count(*) from l where converted_at is not null),
  'conversion_rate',(select coalesce(round(100.0*count(*) filter(where converted_at is not null)/nullif(count(*),0),1),0) from l),
  'open_opportunities',(select count(*) from o where stage not in ('Won','Lost')),
  'pipeline',(select coalesce(sum(amount),0) from o where stage not in ('Won','Lost')),
  'weighted_pipeline',(select coalesce(sum(amount*probability/100.0),0) from o where stage not in ('Won','Lost')),
  'opportunities',(select count(*) from o),'won_value',(select coalesce(sum(amount),0) from window_o where stage='Won'),
  'lost_value',(select coalesce(sum(amount),0) from window_o where stage='Lost'),
  'activities_today',(select count(*) from a where status not in ('Completed','Cancelled') and due_at>=date_trunc('day',now()) and due_at<date_trunc('day',now())+interval '1 day'),
  'overdue_activities',(select count(*) from a where status not in ('Completed','Cancelled') and due_at<now()),
  'pipeline_by_stage',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select stage,currency,count(*) as count,sum(amount) as value from o group by stage,currency) s),
  'sources',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select source,count(*) as leads,count(*) filter(where converted_at is not null) as converted from l group by source order by count(*) desc) s),
  'won_lost',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select to_char(closed_at,'YYYY-MM') as month,stage,currency,count(*) as count,sum(amount) as value from window_o where stage in ('Won','Lost') group by 1,2,3 order by 1) s),
  'salespeople',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select owner_id,count(*) as opportunities,coalesce(sum(amount) filter(where stage not in ('Won','Lost')),0) as pipeline,coalesce(sum(amount) filter(where stage='Won' and (p_from is null or closed_at>=p_from) and (p_to is null or closed_at<p_to)),0) as won_value,(select count(*) from a where a.owner_id=o.owner_id) as activities from o group by owner_id) s),
  'funnel',jsonb_build_object('leads',(select count(*) from l),'qualified',(select count(*) from l where status in ('Qualified','Converted')),'opportunities',(select count(*) from o where id in(select converted_opportunity_id from l)),'quotes',(select count(*) from q),'won',(select count(*) from window_o where stage='Won')),
  'upcoming_closures',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select id,name,amount,currency,account_id,owner_id,expected_close_date from o where stage not in ('Won','Lost') and expected_close_date between current_date and current_date+30 order by expected_close_date limit 10) s),
  'overdue',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select id,title,owner_id,lead_id,account_id,opportunity_id,due_at from a where status not in ('Completed','Cancelled') and due_at<now() order by due_at limit 10) s),
  'currencies',(select coalesce(jsonb_agg(distinct currency),'[]') from o),
  'period_note','Leads use created date; won/lost use close date. Open pipeline and due activities are current snapshots. Values use the selected currency without FX conversion and are deal value, not invoiced or collected revenue. Dashboard dates use UTC.'
 ) into result;
 return result;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'crm_%' loop
  execute format('revoke all on function %s from public,anon',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
commit;
