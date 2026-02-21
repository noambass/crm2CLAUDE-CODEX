-- AI Layer: conversations, messages, read-only BI function
-- Date: 2026-02-25

-- Conversations: chat sessions (WhatsApp, web, etc.)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  customer_id uuid references public.accounts(id) on delete set null,
  channel text not null default 'whatsapp',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages: individual messages within a conversation
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null,
  content text,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

-- updated_at trigger for conversations
drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists conversations_phone_idx on public.conversations(phone_number, created_at desc);
create index if not exists conversations_customer_idx on public.conversations(customer_id, created_at desc);
create index if not exists conversations_status_idx on public.conversations(status, created_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at asc);

-- RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_auth_all_select on public.conversations;
create policy conversations_auth_all_select on public.conversations for select to authenticated using (auth.uid() is not null);

drop policy if exists conversations_auth_all_insert on public.conversations;
create policy conversations_auth_all_insert on public.conversations for insert to authenticated with check (auth.uid() is not null);

drop policy if exists conversations_auth_all_update on public.conversations;
create policy conversations_auth_all_update on public.conversations for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists conversations_auth_all_delete on public.conversations;
create policy conversations_auth_all_delete on public.conversations for delete to authenticated using (auth.uid() is not null);

drop policy if exists messages_auth_all_select on public.messages;
create policy messages_auth_all_select on public.messages for select to authenticated using (auth.uid() is not null);

drop policy if exists messages_auth_all_insert on public.messages;
create policy messages_auth_all_insert on public.messages for insert to authenticated with check (auth.uid() is not null);

drop policy if exists messages_auth_all_update on public.messages;
create policy messages_auth_all_update on public.messages for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists messages_auth_all_delete on public.messages;
create policy messages_auth_all_delete on public.messages for delete to authenticated using (auth.uid() is not null);

-- Read-only SQL execution function for BI queries
-- Called from the AI BI API route with SUPABASE_SERVICE_ROLE_KEY
-- Validates that only SELECT statements are allowed before execution
create or replace function public.exec_readonly_sql(query text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
  normalized text;
begin
  normalized := lower(trim(query));

  if not (normalized like 'select%') then
    raise exception 'Only SELECT queries are allowed';
  end if;

  if normalized ~* '(;\s*(insert|update|delete|drop|create|alter|truncate|grant|revoke|copy)\s)|(^(insert|update|delete|drop|create|alter|truncate|grant|revoke|copy)\s)' then
    raise exception 'Query contains disallowed SQL keywords';
  end if;

  execute format('select json_agg(t) from (%s) t', query) into result;
  return coalesce(result, '[]'::json);
end;
$$;

revoke all on function public.exec_readonly_sql(text) from public;
grant execute on function public.exec_readonly_sql(text) to service_role;

notify pgrst, 'reload schema';
