-- Read-only production smoke checks. JWT context is transaction-local; no demo records.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from org_members where role='owner' order by created_at limit 1),true);
set local role authenticated;
do $$
declare workspace uuid; metrics jsonb;
begin
 select default_org_id into workspace from profiles where id=auth.uid();
 if workspace is null or not crm_can(workspace,'leads','create',auth.uid()) then raise exception 'Owner CRM access failed'; end if;
 perform crm_members(workspace);
 perform crm_access(workspace);
 perform crm_workspaces();
 metrics:=crm_metrics(workspace);
 if metrics is null or not metrics ? 'pipeline' then raise exception 'CRM metrics failed'; end if;
 perform crm_pipeline(workspace,'Qualification');
 if not exists(select 1 from app_state where org_id=workspace and key='presets') then raise exception 'Legacy presets inaccessible'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
do $$
begin
 if exists(select 1 from crm_accounts) or exists(select 1 from crm_leads) or exists(select 1 from crm_events) then raise exception 'Non-member CRM isolation failed'; end if;
 if exists(select 1 from tracked_quotes) or exists(select 1 from app_state) then raise exception 'Non-member legacy isolation failed'; end if;
end $$;
rollback;
select jsonb_build_object(
 'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'crm_%' and c.relkind='r' and c.relrowsecurity),
 'crm_records',jsonb_build_object('leads',(select count(*) from crm_leads),'accounts',(select count(*) from crm_accounts),'contacts',(select count(*) from crm_contacts),'opportunities',(select count(*) from crm_opportunities),'inbox',(select count(*) from crm_inbox)),
 'legacy_counts',jsonb_build_object('profiles',(select count(*) from profiles),'organizations',(select count(*) from organizations),'app_state',(select count(*) from app_state),'tracked_quotes',(select count(*) from tracked_quotes),'quote_events',(select count(*) from quote_events)),
 'scheduler',(select jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'active',active)) from cron.job where jobname='qyrova-crm-reminders'),
 'scheduler_runs',(select jsonb_agg(to_jsonb(r)) from (select status,return_message,start_time from cron.job_run_details where jobid in(select jobid from cron.job where jobname='qyrova-crm-reminders') order by start_time desc limit 3) r)
) as verification;
