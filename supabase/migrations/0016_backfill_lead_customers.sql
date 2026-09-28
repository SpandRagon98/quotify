-- Bring older active leads into the same account/contact lifecycle.
begin;

create or replace function crm_private.ensure_lead_customer(p_lead uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l crm_leads; a crm_accounts; c crm_contacts; customer_name text; personal boolean;
begin
  select * into l from crm_leads where id = p_lead and archived_at is null for update;
  if not found or l.account_id is not null then return; end if;
  personal := nullif(trim(coalesce(l.company_name, '')), '') is null;
  customer_name := case when personal then l.name else trim(l.company_name) end;
  select * into a from crm_accounts where org_id = l.org_id and archived_at is null and lower(trim(name)) = lower(customer_name) order by created_at asc limit 1;
  if a.id is null then
    insert into crm_accounts(org_id, owner_id, name, account_type, industry, website, phone, email, city, state, country, pincode, notes)
      values(l.org_id, l.owner_id, customer_name, case when personal then 'Personal' else 'Company' end,
        l.industry, l.website, l.phone, l.email, l.city, l.state, l.country, l.pincode, l.notes) returning * into a;
  end if;
  select * into c from crm_contacts where org_id = l.org_id and account_id = a.id and archived_at is null and (
    (l.email is not null and lower(email) = lower(l.email)) or
    (nullif(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), '') is not null and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = regexp_replace(l.phone, '[^0-9]', '', 'g'))
  ) order by created_at asc limit 1;
  if c.id is null then
    insert into crm_contacts(org_id, owner_id, account_id, first_name, last_name, designation, email, phone, alternate_phone, is_primary, notes)
      values(l.org_id, l.owner_id, a.id, coalesce(nullif(trim(l.first_name), ''), l.name), l.last_name,
        l.designation, l.email, l.phone, l.alternate_phone,
        not exists(select 1 from crm_contacts where org_id = l.org_id and account_id = a.id and archived_at is null and is_primary), l.notes)
      returning * into c;
  end if;
  update crm_leads set account_id = a.id, contact_id = c.id where id = l.id and account_id is null;
end $$;

create or replace function crm_private.link_lead_customer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform crm_private.ensure_lead_customer(new.id);
  return new;
end $$;

do $$ declare lead_id uuid; begin
  for lead_id in select id from crm_leads where archived_at is null and account_id is null loop
    perform crm_private.ensure_lead_customer(lead_id);
  end loop;
end $$;

commit;
