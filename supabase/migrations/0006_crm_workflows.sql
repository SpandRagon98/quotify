begin;
create table public.crm_workflows (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 name text not null check(length(trim(name)) between 1 and 200), enabled boolean not null default false,
 trigger_type text not null check(trigger_type in ('lead_created','lead_updated','lead_assigned','lead_status_changed','opportunity_created','opportunity_stage_changed','activity_overdue','quote_created','quote_status_changed','account_created')),
 conditions jsonb not null default '[]', actions jsonb not null default '[]',
 created_by uuid not null default auth.uid() references auth.users, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(jsonb_typeof(conditions)='array' and jsonb_array_length(conditions)<=20),
 check(jsonb_typeof(actions)='array' and jsonb_array_length(actions) between 1 and 10)
);
create table public.crm_workflow_executions (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade,
 workflow_id uuid not null references public.crm_workflows on delete cascade, event_id uuid not null references public.crm_events on delete cascade,
 status text not null check(status in ('Succeeded','Skipped','Failed')), error text, created_at timestamptz not null default now(), unique(workflow_id,event_id)
);
create index crm_workflow_enabled on public.crm_workflows(org_id,trigger_type) where enabled;
create index crm_execution_date on public.crm_workflow_executions(org_id,created_at desc);
alter table public.crm_workflows enable row level security;
alter table public.crm_workflow_executions enable row level security;
revoke all on public.crm_workflows,public.crm_workflow_executions from authenticated;
grant select,insert,update,delete on public.crm_workflows to authenticated;
grant select on public.crm_workflow_executions to authenticated;
revoke all on public.crm_workflows,public.crm_workflow_executions from anon;
create policy workflow_admin on public.crm_workflows for all to authenticated using(crm_can(org_id,'workflows','edit',auth.uid())) with check(crm_can(org_id,'workflows','edit',auth.uid()));
create policy executions_admin on public.crm_workflow_executions for select to authenticated using(crm_can(org_id,'workflows','view',auth.uid()));

create function crm_private.validate_workflow() returns trigger language plpgsql set search_path=public as $$
declare a jsonb; c jsonb;
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.org_id<>old.org_id or new.created_at<>old.created_at then raise exception 'Immutable workflow identity'; end if;
  new.created_by:=old.created_by;
 else new.created_by:=auth.uid(); end if;
 for c in select value from jsonb_array_elements(new.conditions) loop
  if coalesce(c->>'field','') not in ('source','estimated_value','amount','owner_id','status','stage','priority','city','state','tags','product') or coalesce(c->>'operator','') not in ('equals','not_equals','greater_than','contains') or not c ? 'value' then raise exception 'Invalid workflow condition'; end if;
 end loop;
 for a in select value from jsonb_array_elements(new.actions) loop
  if coalesce(a->>'type','') not in ('assign_owner','create_task','create_follow_up','update_status','update_stage','update_priority','add_tag','notification','internal_note') then raise exception 'Unsupported action. Email and external messaging are not configured safely.'; end if;
  if a->>'type' in ('create_task','create_follow_up') and (coalesce(a->>'title','')='' or coalesce((a->>'due_minutes')::int,30) not between 0 and 525600) then raise exception 'Task requires a title and valid due delay'; end if;
  if a->>'type'='assign_owner' and not exists(select 1 from org_members where org_id=new.org_id and user_id=(a->>'value')::uuid) then raise exception 'Workflow owner must be a workspace member'; end if;
 end loop;
 new.updated_at:=now(); return new;
end $$;
create trigger validate_workflow before insert or update on public.crm_workflows for each row execute function crm_private.validate_workflow();

create function crm_private.run_workflows(p_event uuid,p_record jsonb) returns void language plpgsql security definer set search_path=public as $$
declare e crm_events; w crm_workflows; c jsonb; a jsonb; matches boolean; tab text; owner uuid; previous_flag text; failure text; run_id uuid; field text;
begin
 if current_setting('qyrova.workflow',true)='on' then return; end if;
 select * into e from crm_events where id=p_event;
 if not found then return; end if;
 tab:=case e.entity_type when 'leads' then 'crm_leads' when 'opportunities' then 'crm_opportunities' when 'activities' then 'crm_activities' when 'accounts' then 'crm_accounts' when 'quote_links' then 'crm_quote_links' else null end;
 if tab is null then return; end if;
 for w in select * from crm_workflows where org_id=e.org_id and enabled and trigger_type=e.event_type order by created_at,id loop
  run_id:=null;
  insert into crm_workflow_executions(org_id,workflow_id,event_id,status) values(e.org_id,w.id,e.id,'Skipped') on conflict(workflow_id,event_id) do nothing returning id into run_id;
  if run_id is null then continue; end if;
  begin
   matches:=true;
   for c in select value from jsonb_array_elements(w.conditions) loop
    case c->>'operator'
     when 'equals' then matches:=matches and coalesce(p_record->> (c->>'field'),'')=coalesce(c->>'value','');
     when 'not_equals' then matches:=matches and coalesce(p_record->> (c->>'field'),'')<>coalesce(c->>'value','');
     when 'greater_than' then matches:=matches and coalesce((p_record->>(c->>'field'))::numeric,0)>(c->>'value')::numeric;
     when 'contains' then matches:=matches and case when c->>'field'='tags' then coalesce(p_record->'tags','[]') ? (c->>'value') else position(lower(c->>'value') in lower(coalesce(p_record->>(c->>'field'),'')))>0 end;
    end case;
   end loop;
   if not matches then continue; end if;
   owner:=e.owner_id; previous_flag:=current_setting('qyrova.workflow',true);
   perform set_config('qyrova.workflow','on',true);
   for a in select value from jsonb_array_elements(w.actions) loop
    case a->>'type'
     when 'assign_owner' then
      owner:=(a->>'value')::uuid;
      if not exists(select 1 from org_members where org_id=e.org_id and user_id=owner) then raise exception 'Assignment target is no longer a member'; end if;
      execute format('update public.%I set owner_id=$1 where org_id=$2 and id=$3',tab) using owner,e.org_id,e.entity_id;
     when 'create_task','create_follow_up' then
      insert into crm_activities(org_id,owner_id,title,activity_type,description,due_at,lead_id,account_id,contact_id,opportunity_id,created_by)
      values(e.org_id,owner,a->>'title',case when a->>'type'='create_task' then 'Task' else 'Follow-up' end,a->>'description',now()+make_interval(mins=>coalesce((a->>'due_minutes')::int,30)),
       case when e.entity_type='leads' then e.entity_id else e.lead_id end,e.account_id,e.contact_id,e.opportunity_id,w.created_by);
     when 'update_status','update_stage','update_priority' then
      field:=case a->>'type' when 'update_status' then 'status' when 'update_stage' then 'stage' else 'priority' end;
      if not ((field='status' and tab in ('crm_leads','crm_activities','crm_quote_links')) or (field='stage' and tab in ('crm_leads','crm_opportunities')) or (field='priority' and tab in ('crm_leads','crm_activities'))) then raise exception 'This action does not apply to the trigger record'; end if;
      execute format('update public.%I set %I=$1 where org_id=$2 and id=$3',tab,field) using a->>'value',e.org_id,e.entity_id;
     when 'add_tag' then
      if nullif(trim(a->>'value'),'') is null then raise exception 'Tag cannot be empty'; end if;
      execute format('update public.%I set tags=array(select distinct unnest(tags || array[$1])) where org_id=$2 and id=$3',tab) using a->>'value',e.org_id,e.entity_id;
     when 'notification' then
      insert into crm_notifications(org_id,user_id,title,body,entity_type,entity_id,dedupe_key)
       values(e.org_id,owner,coalesce(nullif(a->>'title',''),w.name),a->>'value',e.entity_type,e.entity_id,'workflow:'||w.id||':'||e.id) on conflict do nothing;
     when 'internal_note' then
      insert into crm_activities(org_id,owner_id,title,activity_type,description,status,lead_id,account_id,contact_id,opportunity_id,created_by)
      values(e.org_id,owner,w.name,'Note',a->>'value','Completed',case when e.entity_type='leads' then e.entity_id else e.lead_id end,e.account_id,e.contact_id,e.opportunity_id,w.created_by);
    end case;
   end loop;
   perform set_config('qyrova.workflow',coalesce(previous_flag,''),true);
   update crm_workflow_executions set status='Succeeded' where id=run_id;
  exception when others then
   get stacked diagnostics failure=message_text;
   -- The inner subtransaction rolls back all actions and flags on failure.
   update crm_workflow_executions set status='Failed',error=left(failure,2000) where id=run_id;
  end;
 end loop;
end $$;

create function crm_private.record_change() returns trigger language plpgsql security definer set search_path=public as $$
declare d jsonb:=to_jsonb(new); prev jsonb; types text[]; typ text; event_id uuid; entity text:=substring(tg_table_name from 5); display text; acct uuid; lead uuid; contact uuid; opp uuid;
begin
 if tg_op='UPDATE' then
  prev:=to_jsonb(old);
  if (d - 'updated_at' - 'search')=(prev - 'updated_at' - 'search') then return new; end if;
 end if;
 display:=coalesce(d->>'name',d->>'title',d->>'first_name',d->>'quotation_id','Record');
 acct:=case when entity='accounts' then new.id else nullif(d->>'account_id','')::uuid end;
 lead:=case when entity='leads' then new.id else nullif(d->>'lead_id','')::uuid end;
 contact:=case when entity='contacts' then new.id else nullif(d->>'contact_id','')::uuid end;
 opp:=case when entity='opportunities' then new.id else nullif(d->>'opportunity_id','')::uuid end;
 if entity='leads' and nullif(d->>'converted_account_id','') is not null then
  acct:=(d->>'converted_account_id')::uuid; contact:=(d->>'converted_contact_id')::uuid; opp:=(d->>'converted_opportunity_id')::uuid;
  update crm_events set account_id=acct where org_id=new.org_id and lead_id=new.id and account_id is null;
 end if;
 types:=array[case when tg_op='INSERT' then
  case entity when 'leads' then 'lead_created' when 'accounts' then 'account_created' when 'opportunities' then 'opportunity_created' when 'quote_links' then 'quote_created' else entity||'_created' end
  else case entity when 'leads' then 'lead_updated' else entity||'_updated' end end];
 if tg_op='UPDATE' then
  if entity='leads' and d->>'status'<>prev->>'status' then types:=types||'lead_status_changed'::text; end if;
  if entity='leads' and new.owner_id<>old.owner_id then types:=types||'lead_assigned'::text; end if;
  if entity='opportunities' and d->>'stage'<>prev->>'stage' then types:=types||'opportunity_stage_changed'::text; end if;
  if entity='quote_links' and d->>'status'<>prev->>'status' then types:=types||'quote_status_changed'::text; end if;
 end if;
 foreach typ in array types loop
  insert into crm_events(org_id,owner_id,entity_type,entity_id,account_id,lead_id,contact_id,opportunity_id,event_type,title,detail,actor_id)
   values(new.org_id,new.owner_id,entity,new.id,acct,lead,contact,opp,typ,display||' · '||replace(typ,'_',' '),
    case when typ='opportunity_stage_changed' then (prev->>'stage')||' → '||(d->>'stage')
         when typ='lead_status_changed' then (prev->>'status')||' → '||(d->>'status')
         when typ='quote_status_changed' then (prev->>'status')||' → '||(d->>'status')
         when entity='activities' then concat_ws(' · ',d->>'activity_type',d->>'status',d->>'outcome',d->>'description') else null end,auth.uid()) returning id into event_id;
  perform crm_private.run_workflows(event_id,d);
 end loop;
 if (tg_op='INSERT' or d->>'owner_id' is distinct from prev->>'owner_id') and entity in ('leads','opportunities','activities') then
  insert into crm_notifications(org_id,user_id,title,body,entity_type,entity_id,dedupe_key)
   values(new.org_id,new.owner_id,'Assigned: '||display,'A '||entity||' record is assigned to you.',entity,new.id,'assigned:'||new.id||':'||new.updated_at) on conflict do nothing;
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['crm_accounts','crm_contacts','crm_leads','crm_opportunities','crm_activities','crm_inbox','crm_quote_links'] loop
  execute format('create trigger record_crm_change after insert or update on public.%I for each row execute function crm_private.record_change()',t);
 end loop;
end $$;

create function crm_private.quote_tracking_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update crm_quote_links set status=new.status where org_id=new.org_id and quotation_id=new.quotation_id and preset_name=new.preset_name and status<>new.status;
 return new;
end $$;
create trigger crm_quote_status after insert or update of status on public.tracked_quotes for each row execute function crm_private.quote_tracking_change();

create function public.crm_log_quote_email(p_org uuid,p_quotation text,p_preset text,p_recipient text)
returns void language plpgsql security invoker set search_path=public as $$
declare q crm_quote_links;
begin
 select * into q from crm_quote_links where org_id=p_org and quotation_id=p_quotation and preset_id=p_preset and archived_at is null;
 if not found then return; end if;
 if not crm_can(p_org,'quotations','edit',q.owner_id) then raise exception 'Quotation access required'; end if;
 insert into crm_activities(org_id,owner_id,title,activity_type,description,status,outcome,account_id,contact_id,opportunity_id,lead_id)
 values(q.org_id,auth.uid(),'Quotation '||p_quotation||' email sent','Email','Recipient: '||p_recipient,'Completed','Sent through existing email integration',q.account_id,q.contact_id,q.opportunity_id,q.lead_id);
end $$;
revoke all on function public.crm_log_quote_email(uuid,text,text,text) from public,anon;
grant execute on function public.crm_log_quote_email(uuid,text,text,text) to authenticated;

-- Scheduler-only: no public/authenticated grant, bounded batches with durable dedupe.
create function crm_private.tick() returns void language plpgsql security definer set search_path=public as $$
declare a crm_activities; eid uuid;
begin
 for a in select * from crm_activities where archived_at is null and status not in ('Completed','Cancelled')
   and due_at<now() and overdue_notified_at is null order by due_at limit 500 for update skip locked loop
  update crm_activities set status='Overdue',overdue_notified_at=now() where id=a.id;
  insert into crm_notifications(org_id,user_id,title,body,entity_type,entity_id,dedupe_key)
   values(a.org_id,a.owner_id,'Overdue: '||a.title,'This activity needs your attention.','activities',a.id,'overdue:'||a.id||':'||a.due_at) on conflict do nothing;
  insert into crm_events(org_id,owner_id,entity_type,entity_id,account_id,lead_id,contact_id,opportunity_id,event_type,title)
   values(a.org_id,a.owner_id,'activities',a.id,a.account_id,a.lead_id,a.contact_id,a.opportunity_id,'activity_overdue',a.title||' · activity overdue') returning id into eid;
  perform crm_private.run_workflows(eid,to_jsonb(a)||jsonb_build_object('status','Overdue'));
 end loop;
 for a in select * from crm_activities where archived_at is null and status not in ('Completed','Cancelled')
   and coalesce(reminder_at,due_at)<=now() and reminder_notified_at is null order by coalesce(reminder_at,due_at) limit 500 for update skip locked loop
  insert into crm_notifications(org_id,user_id,title,body,entity_type,entity_id,dedupe_key)
   values(a.org_id,a.owner_id,'Due: '||a.title,'Your scheduled activity reminder.','activities',a.id,'reminder:'||a.id||':'||coalesce(a.reminder_at,a.due_at)) on conflict do nothing;
  update crm_activities set reminder_notified_at=now() where id=a.id;
 end loop;
end $$;
revoke all on all functions in schema crm_private from public,anon,authenticated;
commit;
