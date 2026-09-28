-- Customer-approved scope, cost and schedule changes. A customer only receives
-- a random capability URL; all internal records remain protected by RLS.
begin;

create table public.crm_change_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  owner_id uuid not null default auth.uid(),
  account_id uuid not null,
  opportunity_id uuid,
  contact_id uuid,
  order_number text not null unique,
  title text not null check (length(trim(title)) between 1 and 200),
  reason text,
  scope_before text,
  scope_after text not null check (length(trim(scope_after)) between 1 and 10000),
  delta_amount numeric(18,2) not null default 0 check (delta_amount >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  delta_days integer not null default 0 check (delta_days between 0 and 3650),
  customer_email text,
  status text not null default 'Draft' check (status in ('Draft', 'Sent for approval', 'Approved', 'Rejected', 'Cancelled')),
  share_token uuid not null unique default gen_random_uuid(),
  sent_at timestamptz,
  responded_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  customer_name text,
  customer_response_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(org_id, id),
  foreign key(org_id, owner_id) references public.org_members(org_id, user_id),
  foreign key(org_id, account_id) references public.crm_accounts(org_id, id),
  foreign key(org_id, account_id, opportunity_id) references public.crm_opportunities(org_id, account_id, id),
  foreign key(org_id, account_id, contact_id) references public.crm_contacts(org_id, account_id, id)
);

create function crm_private.validate_change_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists(select 1 from org_members where org_id = new.org_id and user_id = new.owner_id) then
      raise exception 'Owner must belong to this workspace';
    end if;
    new.order_number := coalesce(nullif(trim(new.order_number), ''), 'CO-' || upper(substr(replace(new.id::text, '-', ''), 1, 8)));
  end if;
  if new.customer_email is not null then
    new.customer_email := nullif(lower(trim(new.customer_email)), '');
    if new.customer_email is not null and new.customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception 'Invalid customer email';
    end if;
  end if;
  if new.status = 'Sent for approval' and new.sent_at is null then
    if new.customer_email is null then raise exception 'Add the customer email before sending for approval'; end if;
    new.sent_at := now();
  end if;
  if tg_op = 'UPDATE' and old.status <> new.status and new.status in ('Approved', 'Rejected')
    and coalesce(current_setting('qyrova.change_order_response', true), '') <> 'on' then
    raise exception 'Customer approval must be recorded through the approval link';
  end if;
  if tg_op = 'UPDATE' and old.status in ('Approved', 'Rejected') and new.status is distinct from old.status then
    raise exception 'A customer decision is final. Create a new change order for a revised scope.';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger validate_crm_change_order
  before insert or update on public.crm_change_orders
  for each row execute function crm_private.validate_change_order();

alter table public.crm_change_orders enable row level security;
revoke all on public.crm_change_orders from public, anon, authenticated;
grant select, insert, update on public.crm_change_orders to authenticated;
create policy crm_change_orders_read on public.crm_change_orders for select to authenticated
  using (public.crm_can(org_id, 'opportunities', 'view', owner_id));
create policy crm_change_orders_create on public.crm_change_orders for insert to authenticated
  with check (public.crm_can(org_id, 'opportunities', 'create', owner_id));
create policy crm_change_orders_update on public.crm_change_orders for update to authenticated
  using (public.crm_can(org_id, 'opportunities', 'edit', owner_id))
  with check (public.crm_can(org_id, 'opportunities', 'edit', owner_id));
create index crm_change_orders_account on public.crm_change_orders(org_id, account_id, created_at desc) where archived_at is null;
create index crm_change_orders_opportunity on public.crm_change_orders(org_id, opportunity_id, created_at desc) where archived_at is null;

create function public.crm_change_order_public(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order_number', c.order_number,
    'title', c.title,
    'reason', c.reason,
    'scope_before', c.scope_before,
    'scope_after', c.scope_after,
    'delta_amount', c.delta_amount,
    'currency', c.currency,
    'delta_days', c.delta_days,
    'status', c.status,
    'sent_at', c.sent_at,
    'responded_at', c.responded_at,
    'customer_name', c.customer_name,
    'customer_response_note', c.customer_response_note
  )
  from public.crm_change_orders c
  where c.share_token = p_token and c.archived_at is null and c.status in ('Sent for approval', 'Approved', 'Rejected');
$$;

create function public.crm_respond_change_order(
  p_token uuid, p_decision text, p_customer_name text, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.crm_change_orders; next_status text;
begin
  if p_decision not in ('Approved', 'Rejected') then raise exception 'Invalid decision'; end if;
  if length(trim(coalesce(p_customer_name, ''))) not between 2 and 120 then
    raise exception 'Enter your full name to confirm this decision';
  end if;
  select * into c from public.crm_change_orders where share_token = p_token and archived_at is null for update;
  if not found then raise exception 'Change order not found'; end if;
  if c.status in ('Approved', 'Rejected') then
    return jsonb_build_object('status', c.status, 'already', true, 'responded_at', c.responded_at);
  end if;
  if c.status <> 'Sent for approval' then raise exception 'This change order is not available for customer approval'; end if;
  next_status := p_decision;
  perform set_config('qyrova.change_order_response', 'on', true);
  update public.crm_change_orders
    set status = next_status,
        customer_name = trim(p_customer_name),
        customer_response_note = nullif(left(trim(coalesce(p_note, '')), 10000), ''),
        responded_at = now(),
        approved_at = case when next_status = 'Approved' then now() else null end,
        rejected_at = case when next_status = 'Rejected' then now() else null end
    where id = c.id;
  insert into public.crm_events(org_id, owner_id, entity_type, entity_id, account_id, opportunity_id, event_type, title, detail)
    values (c.org_id, c.owner_id, 'change_orders', c.id, c.account_id, c.opportunity_id,
      case when next_status = 'Approved' then 'change_order_approved' else 'change_order_rejected' end,
      c.order_number || ' ' || lower(next_status) || ' by customer',
      nullif(left(trim(coalesce(p_note, '')), 10000), ''));
  return jsonb_build_object('status', next_status, 'responded_at', now());
end $$;

revoke all on function public.crm_change_order_public(uuid), public.crm_respond_change_order(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.crm_change_order_public(uuid), public.crm_respond_change_order(uuid, text, text, text) to anon, authenticated;

commit;
