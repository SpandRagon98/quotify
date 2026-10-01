-- Daily operating system: a calm five-area CRM surface backed by the
-- existing records. These additions are additive; no historical record or
-- automation is changed or deleted.
begin;

alter table public.crm_leads add column if not exists collaborator_ids uuid[] not null default '{}', add column if not exists handover_note text;
alter table public.crm_accounts add column if not exists collaborator_ids uuid[] not null default '{}', add column if not exists handover_note text;
alter table public.crm_contacts add column if not exists collaborator_ids uuid[] not null default '{}', add column if not exists handover_note text;
alter table public.crm_opportunities add column if not exists collaborator_ids uuid[] not null default '{}', add column if not exists handover_note text;
alter table public.crm_activities add column if not exists collaborator_ids uuid[] not null default '{}', add column if not exists handover_note text;

create or replace function crm_private.validate_collaborators()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if cardinality(coalesce(new.collaborator_ids,'{}')) > 10 then raise exception 'Choose at most 10 collaborators'; end if;
  new.collaborator_ids := coalesce(array(
    select distinct member_id from unnest(coalesce(new.collaborator_ids,'{}'::uuid[])) member_id
    where member_id is not null and member_id <> new.owner_id order by member_id
  ),'{}'::uuid[]);
  if exists(select 1 from unnest(new.collaborator_ids) member_id where not exists(select 1 from org_members where org_id=new.org_id and user_id=member_id)) then
    raise exception 'Each collaborator must belong to this workspace';
  end if;
  new.handover_note := nullif(left(trim(coalesce(new.handover_note,'')),2000),'');
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['crm_leads','crm_accounts','crm_contacts','crm_opportunities','crm_activities'] loop
    execute format('drop trigger if exists validate_collaborators_%I on public.%I',t,t);
    execute format('create trigger validate_collaborators_%I before insert or update on public.%I for each row execute function crm_private.validate_collaborators()',t,t);
  end loop;
end $$;

alter table public.crm_activities drop constraint if exists crm_activities_activity_type_check;
alter table public.crm_activities add constraint crm_activities_activity_type_check
  check(activity_type in ('Task','Call','Meeting','Follow-up','Email','Note','Site visit','Vendor coordination','Payment milestone','Delivery','Handover','Support'));

-- The Today endpoint deliberately answers operational questions with one
-- bounded request instead of making a dashboard load a waterfall of lists.
create or replace function public.crm_today(p_org uuid)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
  if not exists(select 1 from org_members where org_id=p_org and user_id=auth.uid()) then raise exception 'Workspace membership required'; end if;
  with visible_leads as (
    select l.* from crm_leads l where l.org_id=p_org and l.archived_at is null and crm_can(p_org,'leads','view',l.owner_id)
  ), visible_opps as (
    select o.* from crm_opportunities o where o.org_id=p_org and o.archived_at is null and crm_can(p_org,'opportunities','view',o.owner_id)
  ), visible_activities as (
    select a.* from crm_activities a where a.org_id=p_org and a.archived_at is null and crm_can(p_org,'activities','view',a.owner_id)
  )
  select jsonb_build_object(
    'new_leads',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select id,name,company_name,email,phone,owner_id,created_at,lead_score,lead_temperature
      from visible_leads where status='New' order by created_at asc limit 8
    ) x),
    'my_work',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select id,title,activity_type,due_at,status,priority,lead_id,account_id,opportunity_id
      from visible_activities where owner_id=auth.uid() and status not in ('Completed','Cancelled')
        and due_at >= date_trunc('day',now()) and due_at < date_trunc('day',now())+interval '1 day'
      order by due_at limit 12
    ) x),
    'overdue',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select id,title,activity_type,due_at,owner_id,lead_id,account_id,opportunity_id
      from visible_activities where status not in ('Completed','Cancelled') and due_at < now() order by due_at limit 12
    ) x),
    'stalled_deals',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select o.id,o.name,o.amount,o.currency,o.stage,o.owner_id,o.account_id,o.contact_id,o.expected_close_date,o.next_step
      from visible_opps o where o.stage not in ('Won','Lost') and (nullif(trim(o.next_step),'') is null)
        and not exists(select 1 from visible_activities a where a.opportunity_id=o.id and a.status not in ('Completed','Cancelled'))
      order by o.updated_at asc limit 8
    ) x),
    'upcoming_delivery',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select id,title,activity_type,due_at,owner_id,account_id,opportunity_id
      from visible_activities where status not in ('Completed','Cancelled') and activity_type in ('Site visit','Vendor coordination','Payment milestone','Delivery','Handover','Support')
        and due_at >= now() and due_at < now()+interval '7 days' order by due_at limit 10
    ) x),
    'waiting_approvals',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select c.id,c.order_number,c.title,c.customer_email,c.delta_amount,c.currency,c.delta_days,c.sent_at,c.account_id,c.opportunity_id,c.owner_id
      from crm_change_orders c where c.org_id=p_org and c.archived_at is null and c.status='Sent for approval' and crm_can(p_org,'opportunities','view',c.owner_id)
      order by c.sent_at asc limit 10
    ) x),
    'team_snapshot',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select a.owner_id,count(*) filter(where a.status not in ('Completed','Cancelled') and a.due_at < now()) as overdue,
        count(*) filter(where a.status not in ('Completed','Cancelled') and a.due_at >= date_trunc('day',now()) and a.due_at < date_trunc('day',now())+interval '1 day') as due_today,
        count(*) filter(where a.status='Completed' and a.completed_at >= date_trunc('day',now())) as completed_today
      from visible_activities a group by a.owner_id order by overdue desc,due_today desc limit 12
    ) x),
    'generated_at',now()
  ) into result;
  return result;
end $$;

-- One click adds a useful baseline. Teams can still edit, disable or add to
-- these from the existing advanced workflow builder.
create or replace function public.crm_install_starter_playbook(p_org uuid)
returns int language plpgsql security invoker set search_path=public as $$
declare inserted_count int:=0; item jsonb;
begin
  if not crm_can(p_org,'workflows','edit',auth.uid()) then raise exception 'Automation administration access required'; end if;
  for item in select value from jsonb_array_elements('[
    {"name":"Respond to new enquiry","trigger":"lead_created","conditions":[],"actions":[{"type":"create_follow_up","title":"Respond to new enquiry","description":"Make first contact within 15 minutes.","due_minutes":15}]},
    {"name":"Schedule discovery after interest","trigger":"lead_status_changed","conditions":[{"field":"status","operator":"equals","value":"Interested"}],"actions":[{"type":"create_follow_up","title":"Schedule discovery or site visit","description":"Confirm scope, budget and timeline.","due_minutes":1440}]},
    {"name":"Follow up sent quotation","trigger":"quote_created","conditions":[],"actions":[{"type":"create_follow_up","title":"Follow up on quotation","description":"Ask whether the customer has questions.","due_minutes":4320}]},
    {"name":"Start delivery after a win","trigger":"opportunity_stage_changed","conditions":[{"field":"stage","operator":"equals","value":"Won"}],"actions":[{"type":"create_task","title":"Create delivery checklist","description":"Set site visits, vendors, milestones and handover.","due_minutes":0}]},
    {"name":"Capture lost-deal learning","trigger":"opportunity_stage_changed","conditions":[{"field":"stage","operator":"equals","value":"Lost"}],"actions":[{"type":"create_task","title":"Record lost reason and nurture date","description":"Capture learning before future follow-up.","due_minutes":0}]}
  ]'::jsonb) loop
    if not exists(select 1 from crm_workflows where org_id=p_org and name=item->>'name') then
      insert into crm_workflows(org_id,name,enabled,trigger_type,conditions,actions,created_by)
      values(p_org,item->>'name',true,item->>'trigger',item->'conditions',item->'actions',auth.uid());
      inserted_count:=inserted_count+1;
    end if;
  end loop;
  return inserted_count;
end $$;

revoke all on function public.crm_today(uuid),public.crm_install_starter_playbook(uuid) from public,anon;
grant execute on function public.crm_today(uuid),public.crm_install_starter_playbook(uuid) to authenticated;
commit;
