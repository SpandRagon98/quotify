-- A transparent, server-calculated score for every lead.  Scores are never
-- accepted from the browser, which keeps website, Telegram, Excel and manual
-- leads comparable.
begin;

alter table public.crm_leads
  add column if not exists lead_score integer not null default 0
    check (lead_score between 0 and 100),
  add column if not exists lead_temperature text not null default 'Nurture'
    check (lead_temperature in ('Hot', 'Warm', 'Nurture')),
  add column if not exists lead_score_reasons jsonb not null default '[]'::jsonb
    check (jsonb_typeof(lead_score_reasons) = 'array' and pg_column_size(lead_score_reasons) < 16384);

create or replace function crm_private.score_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  score integer := 0;
  detail jsonb := '[]'::jsonb;
  custom jsonb := coalesce(new.custom_fields, '{}'::jsonb);
  value numeric := coalesce(new.estimated_value, 0);
  possession text := lower(coalesce(custom->>'custom_possession_status', ''));
  timeline text := lower(coalesce(custom->>'custom_timeline', ''));
  budget text := lower(coalesce(custom->>'custom_budget_range', ''));
  area numeric := case when coalesce(custom->>'custom_carpet_area_sqft', '') ~ '^\\d+(\\.\\d+)?$' then (custom->>'custom_carpet_area_sqft')::numeric else null end;
  spaces jsonb := case when jsonb_typeof(custom->'custom_spaces') = 'array' then custom->'custom_spaces' else '[]'::jsonb end;
begin
  -- Contactability: a lead with a direct way to reach the buyer deserves faster attention.
  if nullif(trim(coalesce(new.phone, '')), '') is not null then
    score := score + 8;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Phone number provided', 'points', 8));
  end if;
  if nullif(trim(coalesce(new.email, '')), '') is not null then
    score := score + 6;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Email provided', 'points', 6));
  end if;
  if nullif(trim(coalesce(custom->>'custom_locality', '')), '') is not null then
    score := score + 4;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Locality provided', 'points', 4));
  end if;

  if lower(coalesce(new.source, '')) like 'website%' or lower(coalesce(new.source, '')) like 'telegram%' then
    score := score + 5;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Direct enquiry source', 'points', 5));
  end if;

  if value >= 1000000 then
    score := score + 15;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'High estimated project value', 'points', 15));
  elsif value >= 500000 then
    score := score + 12;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Strong estimated project value', 'points', 12));
  elsif value >= 200000 then
    score := score + 8;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Estimated project value entered', 'points', 8));
  elsif value > 0 then
    score := score + 4;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Estimated project value entered', 'points', 4));
  end if;

  if new.priority = 'Urgent' then
    score := score + 12;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Marked urgent', 'points', 12));
  elsif new.priority = 'High' then
    score := score + 8;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Marked high priority', 'points', 8));
  end if;

  if new.status = 'Qualified' then
    score := score + 15;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Sales qualified', 'points', 15));
  elsif new.status = 'Contacted' then
    score := score + 8;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Customer contacted', 'points', 8));
  elsif new.status = 'Attempted Contact' then
    score := score + 3;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Contact attempt recorded', 'points', 3));
  end if;

  if possession = 'possession received' then
    score := score + 15;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Home is ready for work', 'points', 15));
  elsif possession = 'renovation in progress' then
    score := score + 12;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Renovation is in progress', 'points', 12));
  elsif possession = 'under construction' then
    score := score + 7;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Home is under construction', 'points', 7));
  end if;

  if timeline = 'immediately' then
    score := score + 15;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Immediate timeline', 'points', 15));
  elsif timeline = 'within 3 months' then
    score := score + 12;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Timeline within three months', 'points', 12));
  elsif timeline = '3–6 months' then
    score := score + 6;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Timeline within six months', 'points', 6));
  elsif timeline = '6–12 months' then
    score := score + 2;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Timeline within a year', 'points', 2));
  end if;

  if budget <> '' and budget <> 'not sure' then
    score := score + 7;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Budget shared', 'points', 7));
  end if;
  if area >= 1000 then
    score := score + 6;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Carpet area 1,000 sq ft or more', 'points', 6));
  elsif area > 0 then
    score := score + 3;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Carpet area shared', 'points', 3));
  end if;
  if spaces ? 'Full Home' then
    score := score + 7;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Full-home scope', 'points', 7));
  elsif jsonb_array_length(spaces) > 0 then
    score := score + 3;
    detail := detail || jsonb_build_array(jsonb_build_object('label', 'Project scope shared', 'points', 3));
  end if;

  new.lead_score := least(score, 100);
  new.lead_temperature := case when score >= 70 then 'Hot' when score >= 40 then 'Warm' else 'Nurture' end;
  new.lead_score_reasons := detail;
  return new;
end $$;

drop trigger if exists score_crm_lead on public.crm_leads;
create trigger score_crm_lead
  before insert or update on public.crm_leads
  for each row execute function crm_private.score_lead();

-- Calculate scores for the leads that existed before this feature.
update public.crm_leads set lead_score = lead_score;

create index if not exists crm_leads_score
  on public.crm_leads(org_id, lead_temperature, lead_score desc)
  where archived_at is null;

commit;
