-- Apply in the Supabase SQL editor. Only server-side service role may access these tables.
create table if not exists public.siwe_nonces (
  nonce text primary key,
  wallet_address text not null,
  chain_id bigint not null check (chain_id = 99801),
  expires_at timestamptz not null
);
create index if not exists siwe_nonces_expiry_idx on public.siwe_nonces (expires_at);

create table if not exists public.app_sessions (
  token_hash text primary key check (length(token_hash) = 64),
  wallet_address text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists app_sessions_expiry_idx on public.app_sessions (expires_at);

create table if not exists public.shop_profiles (
  shop_id bigint primary key check (shop_id > 0),
  creator_address text not null,
  token_address text not null,
  name text not null check (char_length(name) between 3 and 80),
  description text not null default '' check (char_length(description) <= 1500),
  ascend_launch_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_content (
  id uuid primary key default gen_random_uuid(),
  shop_id bigint not null references public.shop_profiles(shop_id) on delete cascade,
  creator_address text not null,
  title text not null check (char_length(title) between 3 and 140),
  kind text not null check (kind in ('post','download')),
  body text,
  storage_key text,
  filename text,
  created_at timestamptz not null default now(),
  check ((kind='post' and body is not null and storage_key is null)
      or (kind='download' and body is null and storage_key is not null))
);
create index if not exists shop_content_shop_idx on public.shop_content(shop_id, created_at desc);

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key check (length(bucket_key) = 64),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0)
);

alter table public.siwe_nonces enable row level security;
alter table public.app_sessions enable row level security;
alter table public.shop_profiles enable row level security;
alter table public.shop_content enable row level security;
alter table public.rate_limit_buckets enable row level security;
-- No anon/authenticated access policies. Server routes use the service role after
-- independently authenticating the wallet and checking on-chain access.

create or replace function public.consume_siwe_nonce(p_nonce text, p_address text, p_chain_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare deleted_nonce text;
begin
  delete from public.siwe_nonces
  where nonce = p_nonce and wallet_address = lower(p_address)
    and chain_id = p_chain_id and expires_at > now()
  returning nonce into deleted_nonce;
  return deleted_nonce is not null;
end;
$$;
revoke all on function public.consume_siwe_nonce(text,text,bigint) from public, anon, authenticated;
grant execute on function public.consume_siwe_nonce(text,text,bigint) to service_role;

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare allowed boolean;
begin
  if p_limit <= 0 or p_window_seconds <= 0 or length(p_key) <> 64 then
    return false;
  end if;
  insert into public.rate_limit_buckets(bucket_key, window_started_at, request_count)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update
  set request_count = case
    when public.rate_limit_buckets.window_started_at <= now() - (p_window_seconds || ' seconds')::interval then 1
    else public.rate_limit_buckets.request_count + 1
  end,
  window_started_at = case
    when public.rate_limit_buckets.window_started_at <= now() - (p_window_seconds || ' seconds')::interval then now()
    else public.rate_limit_buckets.window_started_at
  end;
  select request_count <= p_limit into allowed from public.rate_limit_buckets where bucket_key = p_key;
  return coalesce(allowed, false);
end;
$$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
