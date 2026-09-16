begin;
-- Narrow authorized history RPC: Finance can report a quotation email without
-- obtaining general activity-write permissions. This is client-reported history,
-- not an assertion that the database independently verified Gmail delivery.
create or replace function public.crm_log_quote_email(p_org uuid,p_quotation text,p_preset text,p_recipient text)
returns void language plpgsql security definer set search_path=public as $$
declare q crm_quote_links;
begin
 if not is_org_member(p_org) then raise exception 'Workspace membership required'; end if;
 if p_recipient is null or length(p_recipient)>320 or p_recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid recipient'; end if;
 select * into q from crm_quote_links where org_id=p_org and quotation_id=p_quotation and preset_id=p_preset and archived_at is null;
 if not found then return; end if; -- Historical unlinked quotation, unchanged.
 if not crm_can(p_org,'quotations','edit',q.owner_id) then raise exception 'Quotation access required'; end if;
 insert into crm_events(org_id,owner_id,entity_type,entity_id,account_id,contact_id,opportunity_id,lead_id,event_type,title,detail,actor_id)
 values(q.org_id,q.owner_id,'quote_links',q.id,q.account_id,q.contact_id,q.opportunity_id,q.lead_id,
  'quote_email_reported','Quotation '||q.quotation_id||' email reported as sent',
  'Client-reported successful send through the existing email integration. Recipient: '||lower(trim(p_recipient)),auth.uid());
end $$;
revoke all on function public.crm_log_quote_email(uuid,text,text,text) from public,anon;
grant execute on function public.crm_log_quote_email(uuid,text,text,text) to authenticated;
commit;
