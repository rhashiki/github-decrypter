-- Build 22 — Commercial Platform
-- Server-authoritative trial, recurring plans/subscriptions and commercial entitlement metadata.

alter table public.ld_license_keys
  add column if not exists commercial_tier text not null default 'legacy',
  add column if not exists byok_allowed boolean not null default false;

alter table public.ld_license_keys
  drop constraint if exists ld_license_keys_commercial_tier_check;
alter table public.ld_license_keys
  add constraint ld_license_keys_commercial_tier_check
  check (commercial_tier in ('legacy','owner','trial','subscription'));

update public.ld_license_keys
set commercial_tier='owner', byok_allowed=true, updated_at=now()
where coalesce((metadata->>'owner_unlimited')::boolean,false)=true;

create table if not exists public.ld_commercial_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  product_id uuid not null references public.ld_products(id) on delete restrict,
  billing_frequency integer not null default 1 check (billing_frequency > 0),
  billing_frequency_type text not null check (billing_frequency_type in ('months','years')),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  byok_allowed boolean not null default true,
  active boolean not null default true,
  provider_plan_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ld_commercial_plans(code,name,product_id,billing_frequency,billing_frequency_type,price_cents,currency,byok_allowed,metadata)
select 'subscription_monthly','Mensal',p.id,1,'months',p.price_cents,p.currency,true,jsonb_build_object('source_product_code',p.code,'duration_days',p.duration_days)
from public.ld_products p where p.code='time_30d' and p.active=true
on conflict (code) do update set product_id=excluded.product_id,price_cents=excluded.price_cents,currency=excluded.currency,active=true,updated_at=now();

insert into public.ld_commercial_plans(code,name,product_id,billing_frequency,billing_frequency_type,price_cents,currency,byok_allowed,metadata)
select 'subscription_annual','Anual',p.id,1,'years',p.price_cents,p.currency,true,jsonb_build_object('source_product_code',p.code,'duration_days',p.duration_days)
from public.ld_products p where p.code='time_365d' and p.active=true
on conflict (code) do update set product_id=excluded.product_id,price_cents=excluded.price_cents,currency=excluded.currency,active=true,updated_at=now();

create table if not exists public.ld_trials (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null unique check (email_hash ~ '^[a-f0-9]{64}$'),
  device_hash text not null unique check (device_hash ~ '^[a-f0-9]{64}$'),
  license_id uuid unique references public.ld_license_keys(id) on delete set null,
  status text not null default 'reserved' check (status in ('reserved','active','expired','failed')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > started_at)
);
create index if not exists ld_trials_license_idx on public.ld_trials(license_id);
create index if not exists ld_trials_expiry_idx on public.ld_trials(expires_at);

create table if not exists public.ld_subscriptions (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  plan_id uuid not null references public.ld_commercial_plans(id) on delete restrict,
  provider text not null default 'mercadopago' check (provider in ('mercadopago')),
  provider_subscription_id text unique,
  status text not null default 'pending' check (status in ('pending','authorized','paused','cancelled','expired','failed')),
  customer_email text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_payment_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  last_payment_id text,
  last_payment_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ld_subscriptions_license_idx on public.ld_subscriptions(license_id,created_at desc);
create index if not exists ld_subscriptions_status_idx on public.ld_subscriptions(status,next_payment_at);

create table if not exists public.ld_subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.ld_subscriptions(id) on delete cascade,
  provider text not null default 'mercadopago',
  event_key text not null unique,
  event_type text not null,
  resource_id text,
  outcome text not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists ld_subscription_events_subscription_idx on public.ld_subscription_events(subscription_id,created_at desc);

alter table public.ld_commercial_plans enable row level security;
alter table public.ld_trials enable row level security;
alter table public.ld_subscriptions enable row level security;
alter table public.ld_subscription_events enable row level security;

revoke all on table public.ld_commercial_plans from anon, authenticated;
revoke all on table public.ld_trials from anon, authenticated;
revoke all on table public.ld_subscriptions from anon, authenticated;
revoke all on table public.ld_subscription_events from anon, authenticated;

create or replace function public.ld_commercial_snapshot(p_license_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with lic as (
    select id,commercial_tier,byok_allowed,status,expires_at,credit_balance,credit_debt,command_remainder,commands_per_credit
    from public.ld_license_keys where id=p_license_id
  ), sub as (
    select s.id,s.status,s.current_period_end,s.next_payment_at,s.cancel_at_period_end,p.code as plan_code,p.name as plan_name,p.price_cents,p.currency,p.byok_allowed as plan_byok
    from public.ld_subscriptions s join public.ld_commercial_plans p on p.id=s.plan_id
    where s.license_id=p_license_id order by s.created_at desc limit 1
  ), trial as (
    select id,status,started_at,expires_at from public.ld_trials where license_id=p_license_id order by created_at desc limit 1
  )
  select jsonb_build_object(
    'license_id',lic.id,
    'tier',lic.commercial_tier,
    'byok_allowed',lic.byok_allowed,
    'license_status',lic.status,
    'expires_at',lic.expires_at,
    'credits',lic.credit_balance,
    'credit_debt',lic.credit_debt,
    'command_remainder',lic.command_remainder,
    'commands_per_credit',lic.commands_per_credit,
    'subscription',case when sub.id is null then null else jsonb_build_object('id',sub.id,'status',sub.status,'plan_code',sub.plan_code,'plan_name',sub.plan_name,'price_cents',sub.price_cents,'currency',sub.currency,'current_period_end',sub.current_period_end,'next_payment_at',sub.next_payment_at,'cancel_at_period_end',sub.cancel_at_period_end) end,
    'trial',case when trial.id is null then null else jsonb_build_object('id',trial.id,'status',trial.status,'started_at',trial.started_at,'expires_at',trial.expires_at) end
  )
  from lic left join sub on true left join trial on true;
$$;

revoke execute on function public.ld_commercial_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.ld_commercial_snapshot(uuid) to service_role;
