-- Lead-first customer lifecycle: every lead has an account/contact from the
-- outset; only an interested lead creates an opportunity. Archival cascades
-- from the customer structure down, while keeping audit data intact.
begin;

alter table public.crm_leads
  add column if not exists account_id uuid,
  add column if not exists contact_id uuid,
  add column if not exists opportunity_id uuid,
  add column if not exists interested_at timestamptz;

alter table public.crm_leads drop constraint if exists crm_leads_status_check;
alter table public.crm_leads add constraint crm_leads_status_check
  check(status in ('New','Attempted Contact','Contacted','Interested','Qualified','Unqualified','Converted','Lost'));

alter table public.crm_leads
  drop constraint if exists crm_leads_account_link,
  drop constraint if exists crm_leads_contact_link,
  drop constraint if exists crm_leads_opportunity_link;
alter table public.crm_leads
  add constraint crm_leads_account_link foreign key(org_id, account_id) references public.crm_accounts(org_id, id),
  add constraint crm_leads_contact_link foreign key(org_id, account_id, contact_id) references public.crm_contacts(org_id, account_id, id),
  add constraint crm_leads_opportunity_link foreign key(org_id, account_id, opportunity_id) references public.crm_opportunities(org_id, account_id, id);

alter table public.crm_activities
  add column if not exists duration_minutes integer not null default 60
    check(duration_minutes between 5 and 1440);

-- Existing converted records become linked records as well, without changing
-- their historical Converted status.
update public.crm_leads
  set account_id = coalesce(account_id, converted_account_id),
      contact_id = coalesce(contact_id, converted_contact_id),
      opportunity_id = coalesce(opportunity_id, converted_opportunity_id)
where archived_at is null and converted_account_id is not null;

create or replace function crm_private.link_lead_customer()
returns trigger language plpgsql security definer set search_path = public as $$
declare a crm_accounts; c crm_contacts; customer_name text; personal boolean;
begin
  if new.account_id is not null then return new; end if;
  personal := nullif(trim(coalesce(new.company_name, '')), '') is null;
  customer_name := case when personal then new.name else trim(new.company_name) end;
  select * into a from crm_accounts
    where org_id = new.org_id and archived_at is null and lower(trim(name)) = lower(customer_name)
    order by created_at asc limit 1;
  if a.id is null then
    insert into crm_accounts(org_id, owner_id, name, account_type, industry, website, phone, email, city, state, country, pincode, notes)
      values(new.org_id, new.owner_id, customer_name, case when personal then 'Personal' else 'Company' end,
        new.industry, new.website, new.phone, new.email, new.city, new.state, new.country, new.pincode, new.notes)
      returning * into a;
  end if;
  select * into c from crm_contacts
    where org_id = new.org_id and account_id = a.id and archived_at is null and (
      (new.email is not null and lower(email) = lower(new.email)) or
      (nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '') is not null and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = regexp_replace(new.phone, '[^0-9]', '', 'g'))
    ) order by created_at asc limit 1;
  if c.id is null then
    insert into crm_contacts(org_id, owner_id, account_id, first_name, last_name, designation, email, phone, alternate_phone, is_primary, notes)
      values(new.org_id, new.owner_id, a.id, coalesce(nullif(trim(new.first_name), ''), new.name), new.last_name,
        new.designation, new.email, new.phone, new.alternate_phone,
        not exists(select 1 from crm_contacts where org_id = new.org_id and account_id = a.id and archived_at is null and is_primary), new.notes)
      returning * into c;
  end if;
  update crm_leads set account_id = a.id, contact_id = c.id where id = new.id and account_id is null;
  return new;
end $$;

create or replace function crm_private.promote_interested_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare o crm_opportunities;
begin
  if new.archived_at is not null or new.status <> 'Interested' or new.opportunity_id is not null then return new; end if;
  if new.account_id is null then return new; end if;
  select * into o from crm_opportunities where org_id = new.org_id and id = new.opportunity_id and archived_at is null;
  if o.id is null then
    insert into crm_opportunities(org_id, owner_id, account_id, contact_id, name, amount, currency, source, product, description, next_step)
      values(new.org_id, new.owner_id, new.account_id, new.contact_id, new.name || ' opportunity', new.estimated_value,
        'INR', new.source, new.product, new.notes, 'Confirm discovery call and requirements') returning * into o;
    update crm_leads set opportunity_id = o.id, interested_at = coalesce(interested_at, now()) where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists link_crm_lead_customer on public.crm_leads;
create trigger link_crm_lead_customer after insert on public.crm_leads
  for each row execute function crm_private.link_lead_customer();
drop trigger if exists promote_interested_crm_lead on public.crm_leads;
create trigger promote_interested_crm_lead after insert or update of status, account_id, contact_id on public.crm_leads
  for each row execute function crm_private.promote_interested_lead();

create or replace function crm_private.cascade_crm_archive()
returns trigger language plpgsql security definer set search_path = public as $$
declare linked_account uuid; linked_contact uuid; linked_opportunity uuid;
begin
  if old.archived_at is not null or new.archived_at is null then return new; end if;
  -- Cascaded records may point to the account that is being archived. This
  -- trusted trigger intentionally skips relationship visibility checks while
  -- it performs the same transaction's cleanup.
  perform set_config('qyrova.workflow', 'on', true);
  if tg_table_name = 'crm_leads' then
    linked_account := coalesce(old.account_id, old.converted_account_id);
    linked_contact := coalesce(old.contact_id, old.converted_contact_id);
    linked_opportunity := coalesce(old.opportunity_id, old.converted_opportunity_id);
    if linked_opportunity is not null then
      update crm_opportunities set archived_at = now() where org_id = old.org_id and id = linked_opportunity and archived_at is null;
    end if;
    -- Only archive a contact when no active lead still uses it.
    if linked_contact is not null and not exists(select 1 from crm_leads where org_id = old.org_id and archived_at is null and id <> old.id and (contact_id = linked_contact or converted_contact_id = linked_contact)) then
      update crm_contacts set archived_at = now() where org_id = old.org_id and id = linked_contact and archived_at is null;
    end if;
    -- A customer account remains while another active lead still belongs to it.
    if linked_account is not null and not exists(select 1 from crm_leads where org_id = old.org_id and archived_at is null and id <> old.id and (account_id = linked_account or converted_account_id = linked_account)) then
      update crm_accounts set archived_at = now() where org_id = old.org_id and id = linked_account and archived_at is null;
    end if;
  elsif tg_table_name = 'crm_accounts' then
    update crm_leads set archived_at = now() where org_id = old.org_id and archived_at is null and (account_id = old.id or converted_account_id = old.id);
    update crm_contacts set archived_at = now() where org_id = old.org_id and account_id = old.id and archived_at is null;
    update crm_opportunities set archived_at = now() where org_id = old.org_id and account_id = old.id and archived_at is null;
  elsif tg_table_name = 'crm_contacts' then
    -- A contact is removable independently: the lead remains, but no longer
    -- points at an active contact. Converted links are preserved as history.
    update crm_leads set contact_id = null where org_id = old.org_id and archived_at is null and contact_id = old.id and converted_at is null;
  elsif tg_table_name = 'crm_opportunities' then
    update crm_leads set opportunity_id = null where org_id = old.org_id and archived_at is null and opportunity_id = old.id and converted_at is null;
  end if;
  return new;
end $$;

drop trigger if exists cascade_archive_crm_leads on public.crm_leads;
drop trigger if exists cascade_archive_crm_accounts on public.crm_accounts;
drop trigger if exists cascade_archive_crm_contacts on public.crm_contacts;
drop trigger if exists cascade_archive_crm_opportunities on public.crm_opportunities;
create trigger cascade_archive_crm_leads after update of archived_at on public.crm_leads for each row execute function crm_private.cascade_crm_archive();
create trigger cascade_archive_crm_accounts after update of archived_at on public.crm_accounts for each row execute function crm_private.cascade_crm_archive();
create trigger cascade_archive_crm_contacts after update of archived_at on public.crm_contacts for each row execute function crm_private.cascade_crm_archive();
create trigger cascade_archive_crm_opportunities after update of archived_at on public.crm_opportunities for each row execute function crm_private.cascade_crm_archive();

create index if not exists crm_leads_customer_links on public.crm_leads(org_id, account_id, contact_id, opportunity_id) where archived_at is null;

-- Retain the legacy Convert action for existing teams, but reuse the customer
-- records now linked to the lead instead of creating duplicates.
create or replace function public.crm_convert_lead(p_lead uuid,p_account uuid default null,p_create_opportunity boolean default true,p_confirm_duplicate boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare l crm_leads; a crm_accounts; c crm_contacts; o crm_opportunities; duplicate_count int; previous_flag text;
begin
 select * into l from crm_leads where id=p_lead and archived_at is null for update;
 if not found or not crm_can(l.org_id,'leads','edit',l.owner_id) then raise exception 'Lead is unavailable or conversion not permitted'; end if;
 if l.converted_at is not null then return jsonb_build_object('account_id',l.converted_account_id,'contact_id',l.converted_contact_id,'opportunity_id',l.converted_opportunity_id,'already',true); end if;
 if not crm_can(l.org_id,'accounts','create',l.owner_id) or not crm_can(l.org_id,'contacts','create',l.owner_id) then raise exception 'Account and contact creation permission required'; end if;
 if l.account_id is not null then
   select * into a from crm_accounts where id=l.account_id and org_id=l.org_id and archived_at is null;
   if not found then raise exception 'Linked account unavailable'; end if;
 elsif p_account is not null then
   select * into a from crm_accounts where id=p_account and org_id=l.org_id and archived_at is null;
   if not found then raise exception 'Account unavailable'; end if;
 else
   select count(*) into duplicate_count from crm_accounts where org_id=l.org_id and lower(trim(name))=lower(trim(coalesce(nullif(l.company_name,''),l.name))) and archived_at is null;
   if duplicate_count>0 and not p_confirm_duplicate then raise exception 'An account with this name exists. Select it or explicitly confirm creating another.'; end if;
   insert into crm_accounts(org_id,owner_id,name,account_type,industry,website,phone,email,city,state,country,pincode,tags,notes)
    values(l.org_id,l.owner_id,coalesce(nullif(trim(l.company_name),''),l.name),case when nullif(trim(l.company_name),'') is null then 'Personal' else 'Company' end,l.industry,l.website,l.phone,l.email,l.city,l.state,l.country,l.pincode,l.tags,l.notes) returning * into a;
 end if;
 if l.contact_id is not null then
   select * into c from crm_contacts where id=l.contact_id and org_id=l.org_id and account_id=a.id and archived_at is null;
 end if;
 if c.id is null then
  select * into c from crm_contacts where org_id=l.org_id and account_id=a.id and archived_at is null
   and ((l.email is not null and lower(email)=lower(l.email)) or (nullif(regexp_replace(l.phone,'[^0-9]','','g'),'') is not null and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(l.phone,'[^0-9]','','g'))) limit 1;
 end if;
 if c.id is null then
  insert into crm_contacts(org_id,owner_id,account_id,first_name,last_name,designation,email,phone,alternate_phone,is_primary,notes)
   values(l.org_id,l.owner_id,a.id,coalesce(nullif(trim(l.first_name),''),l.name),l.last_name,l.designation,l.email,l.phone,l.alternate_phone,
    not exists(select 1 from crm_contacts where account_id=a.id and org_id=l.org_id and is_primary and archived_at is null),l.notes) returning * into c;
 end if;
 if l.opportunity_id is not null then select * into o from crm_opportunities where id=l.opportunity_id and org_id=l.org_id and archived_at is null; end if;
 if o.id is null and p_create_opportunity then
  insert into crm_opportunities(org_id,owner_id,account_id,contact_id,name,amount,source,product,description)
   values(l.org_id,l.owner_id,a.id,c.id,l.name || ' opportunity',l.estimated_value,l.source,l.product,l.notes) returning * into o;
 end if;
 previous_flag:=current_setting('qyrova.converting',true);
 perform set_config('qyrova.converting','on',true);
 update crm_leads set status='Converted',converted_at=now(),account_id=a.id,contact_id=c.id,opportunity_id=o.id,converted_account_id=a.id,converted_contact_id=c.id,converted_opportunity_id=o.id where id=l.id;
 perform set_config('qyrova.converting',coalesce(previous_flag,''),true);
 update crm_activities set account_id=a.id,contact_id=c.id,opportunity_id=o.id where org_id=l.org_id and lead_id=l.id and archived_at is null;
 return jsonb_build_object('account_id',a.id,'contact_id',c.id,'opportunity_id',o.id);
end $$;

commit;
