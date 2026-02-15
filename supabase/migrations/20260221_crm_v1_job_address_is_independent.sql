-- Keep job address independent from customer contact address during quote conversion.
-- If quote.address_text is empty, the created job address_text stays null.

create or replace function public.convert_quote_to_job(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_quote record;
  v_job_id uuid;
  v_title text;
  v_line_items jsonb;
  v_job_description text;
  v_job_address text;
  v_job_status job_status;
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

  v_title := nullif(trim(coalesce(v_quote.title, '')), '');
  if v_title is null then
    select string_agg(qi.description, ', ' order by qi.sort_order, qi.created_at)
      into v_title
    from public.quote_items qi
    where qi.quote_id = p_quote_id;
  end if;

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

  v_job_description := nullif(trim(coalesce(v_quote.description, '')), '');
  if v_job_description is null then
    v_job_description := nullif(trim(coalesce(v_quote.notes, '')), '');
  end if;

  v_job_address := nullif(trim(coalesce(v_quote.address_text, '')), '');

  if v_quote.scheduled_start_at is null then
    v_job_status := 'waiting_schedule';
  else
    v_job_status := 'waiting_execution';
  end if;

  insert into public.jobs (
    account_id,
    quote_id,
    title,
    description,
    status,
    priority,
    address_text,
    arrival_notes,
    lat,
    lng,
    scheduled_start_at,
    line_items
  ) values (
    v_quote.account_id,
    v_quote.id,
    left(v_title, 255),
    v_job_description,
    v_job_status,
    'normal',
    v_job_address,
    nullif(trim(coalesce(v_quote.arrival_notes, '')), ''),
    v_quote.lat,
    v_quote.lng,
    v_quote.scheduled_start_at,
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
