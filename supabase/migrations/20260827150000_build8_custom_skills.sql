begin;

create table if not exists public.ld_custom_skills (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  slug text not null,
  display_name text not null,
  description text not null default '',
  use_when text not null default '',
  avoid_when text not null default '',
  content_md text not null,
  category text not null default 'custom',
  skill_type text not null default 'mixed',
  risk text not null default 'low',
  enabled boolean not null default true,
  pinned boolean not null default false,
  auto_activation boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ld_custom_skills_license_slug_key unique (license_id, slug),
  constraint ld_custom_skills_skill_type_check check (skill_type = any (array['audit'::text,'action'::text,'mixed'::text,'guardrail'::text])),
  constraint ld_custom_skills_risk_check check (risk = any (array['low'::text,'medium'::text,'high'::text])),
  constraint ld_custom_skills_slug_check check (slug ~ '^custom-[0-9a-f-]{36}$'),
  constraint ld_custom_skills_name_length_check check (char_length(display_name) between 1 and 80),
  constraint ld_custom_skills_description_length_check check (char_length(description) <= 1000),
  constraint ld_custom_skills_use_when_length_check check (char_length(use_when) between 1 and 2000),
  constraint ld_custom_skills_avoid_when_length_check check (char_length(avoid_when) <= 2000),
  constraint ld_custom_skills_content_length_check check (char_length(content_md) between 1 and 100000)
);

create index if not exists ld_custom_skills_license_enabled_idx
  on public.ld_custom_skills (license_id, enabled, auto_activation, sort_order);

alter table public.ld_custom_skills enable row level security;
revoke all on table public.ld_custom_skills from public, anon, authenticated;
grant select, insert, update, delete on table public.ld_custom_skills to service_role;

comment on table public.ld_custom_skills is 'Build 8: license-scoped custom Skills managed only by authoritative Edge Functions.';

commit;
