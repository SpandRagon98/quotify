begin;
create function public.crm_pipeline(p_org uuid,p_stage text,p_page int default 0,p_query text default '',p_owner uuid default null,p_source text default null,p_currency text default 'INR')
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 if p_page not between 0 and 100000 or p_stage not in ('Qualification','Discovery','Demo/Meeting','Proposal/Quotation','Negotiation','Won','Lost') then raise exception 'Invalid pipeline page or stage'; end if;
 with matches as (select o.* from crm_opportunities o where org_id=p_org and archived_at is null and stage=p_stage and currency=p_currency and (p_owner is null or owner_id=p_owner) and (p_source is null or source=p_source) and (nullif(trim(p_query),'') is null or search @@ websearch_to_tsquery('simple',p_query)))
 select jsonb_build_object('count',(select count(*) from matches),'rows',(select coalesce(jsonb_agg(to_jsonb(r)-'search'),'[]') from
  (select m.*, greatest(0,extract(day from now()-m.created_at)::int) as age_days, (select name from crm_accounts where id=m.account_id and org_id=p_org) as account_name,
   (select title||' · '||to_char(due_at,'DD Mon HH24:MI') from crm_activities where opportunity_id=m.id and org_id=p_org and archived_at is null and status not in ('Completed','Cancelled') order by due_at nulls last limit 1) as next_activity
   from matches m order by created_at desc,id limit 25 offset p_page*25) r)) into result;
 return result;
end $$;
create function public.crm_access(p_org uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_object_agg(module,capabilities) from (
  select module,jsonb_object_agg(action,crm_can(p_org,module,action,auth.uid())) as capabilities
  from unnest(array['leads','accounts','contacts','opportunities','activities','inbox','quotations','documents','reports','workflows','settings','users']) module
  cross join unnest(array['view','create','edit','delete','export','manage_all']) action group by module
 ) x;
$$;
create function public.crm_account_summary(p_account uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('primary_contact',(select jsonb_build_object('id',c.id,'name',concat_ws(' ',c.first_name,c.last_name),'email',c.email,'phone',c.phone) from crm_contacts c where c.account_id=a.id and c.org_id=a.org_id and c.archived_at is null and c.is_primary limit 1),'contacts',(select count(*) from crm_contacts c where c.account_id=a.id and c.org_id=a.org_id and c.archived_at is null),
 'opportunities',(select count(*) from crm_opportunities o where o.account_id=a.id and o.org_id=a.org_id and o.archived_at is null),
 'quotations',(select count(*) from crm_quote_links q where q.account_id=a.id and q.org_id=a.org_id and q.archived_at is null),
 'open_activities',(select count(*) from crm_activities c where c.account_id=a.id and c.org_id=a.org_id and c.archived_at is null and c.status not in ('Completed','Cancelled')),
 'values',(select coalesce(jsonb_agg(to_jsonb(v)),'[]') from (select currency,coalesce(sum(amount) filter(where stage not in ('Won','Lost')),0) as pipeline,coalesce(sum(amount) filter(where stage='Won'),0) as won from crm_opportunities where account_id=a.id and org_id=a.org_id and archived_at is null group by currency) v))
 from crm_accounts a where a.id=p_account and a.archived_at is null;
$$;
create function public.crm_export(p_org uuid,p_entity text,p_ids uuid[]) returns jsonb language plpgsql security invoker set search_path=public as $$
declare t text; cap text; result jsonb; permitted boolean;
begin
 t:=case when p_entity in ('leads','accounts','contacts','opportunities','activities','inbox','quote_links') then 'crm_'||p_entity else null end;
 cap:=case p_entity when 'quote_links' then 'quotations' else p_entity end;
 if t is null or cardinality(p_ids) not between 1 and 100 then raise exception 'Select 1–100 permitted records to export'; end if;
 execute format('select coalesce(bool_and(crm_can(org_id,$3,''export'',owner_id)),false),jsonb_agg(to_jsonb(r)-''search'') from public.%I r where org_id=$1 and id=any($2) and archived_at is null',t) into permitted,result using p_org,p_ids,cap;
 if not permitted then raise exception 'Export permission required'; end if;
 return result;
end $$;
revoke all on function public.crm_access(uuid),public.crm_account_summary(uuid),public.crm_export(uuid,text,uuid[]),public.crm_pipeline(uuid,text,int,text,uuid,text,text) from public,anon;
grant execute on function public.crm_access(uuid),public.crm_account_summary(uuid),public.crm_export(uuid,text,uuid[]),public.crm_pipeline(uuid,text,int,text,uuid,text,text) to authenticated;
commit;
