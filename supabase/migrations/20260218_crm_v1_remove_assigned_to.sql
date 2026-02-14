alter table public.jobs
  drop column if exists assigned_to;

drop index if exists public.jobs_assigned_to_scheduled_idx;

create or replace function public.convert_quote_to_job(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_quote record;
  v_primary_contact record;
  v_job_id uuid;
  v_title text;
  v_line_items jsonb;
begin
  select q.*
  into v_quote
  from public.quotes q
  where q.id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote not found';
  end if;

  if v_quote.status <> 'approved' then
    raise exception 'Only approved quote can be converted';
  end if;

  if v_quote.converted_job_id is not null then
    raise exception 'Quote already converted';
  end if;

  select c.*
  into v_primary_contact
  from public.contacts c
  where c.account_id = v_quote.account_id
  order by c.is_primary desc, c.created_at asc
  limit 1;

  select string_agg(qi.description, ', ' order by qi.sort_order, qi.created_at)
    into v_title
  from public.quote_items qi
  where qi.quote_id = p_quote_id;

  if v_title is null or length(trim(v_title)) = 0 then
    v_title := 'Job from approved quote';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', qi.id::text,
        'description', qi.description,
        'quantity', qi.quantity,
        'unit_price', qi.unit_price,
        'line_total', qi.line_total
      )
      order by qi.sort_order, qi.created_at
    ),
    '[]'::jsonb
  )
  into v_line_items
  from public.quote_items qi
  where qi.quote_id = p_quote_id;

  if jsonb_array_length(v_line_items) = 0 then
    raise exception 'Quote must include at least one line item';
  end if;

  insert into public.jobs (
    account_id,
    quote_id,
    title,
    description,
    status,
    priority,
    address_text,
    line_items
  ) values (
    v_quote.account_id,
    v_quote.id,
    left(v_title, 255),
    v_quote.notes,
    'waiting_schedule',
    'normal',
    coalesce(v_primary_contact.address_text, null),
    v_line_items
  )
  returning id into v_job_id;

  update public.quotes
    set converted_job_id = v_job_id,
        updated_at = now()
  where id = p_quote_id;

  return v_job_id;
end;
$fn$;

revoke all on function public.convert_quote_to_job(uuid) from public;
grant execute on function public.convert_quote_to_job(uuid) to authenticated;

notify pgrst, 'reload schema';
