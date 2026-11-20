create table if not exists public.dashboard_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  user_name text not null,
  user_email text not null,
  dashboard_name text not null,
  action text not null check (
    action in ('Viewed dashboard', 'Exported report', 'Shared dashboard', 'Applied filters')
  ),
  device text not null default 'Web',
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

alter table public.dashboard_usage
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists dashboard_usage_created_at_idx
  on public.dashboard_usage (created_at desc);

create index if not exists dashboard_usage_user_email_idx
  on public.dashboard_usage (user_email);

create index if not exists dashboard_usage_user_created_at_idx
  on public.dashboard_usage (user_id, created_at desc);

alter table public.dashboard_usage enable row level security;
revoke all on table public.dashboard_usage from anon, authenticated;
grant all on table public.dashboard_usage to service_role;
grant usage, select on sequence public.dashboard_usage_id_seq to service_role;
grant select, insert on table public.dashboard_usage to authenticated;

drop policy if exists dashboard_usage_select_own on public.dashboard_usage;
create policy dashboard_usage_select_own
  on public.dashboard_usage for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists dashboard_usage_insert_own on public.dashboard_usage;
create policy dashboard_usage_insert_own
  on public.dashboard_usage for insert to authenticated
  with check (user_id = (select auth.uid()));

-- The Express API uses the Supabase service role key on the server.
-- Never expose that key to the browser or commit it to source control.

create table if not exists public.contact_submissions (
  id bigint generated always as identity primary key,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text not null check (char_length(btrim(email)) between 3 and 254),
  phone text not null check (char_length(btrim(phone)) between 7 and 25),
  company text not null check (char_length(btrim(company)) between 1 and 160),
  subject text not null check (char_length(btrim(subject)) between 1 and 120),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);

alter table public.contact_submissions enable row level security;
revoke all on table public.contact_submissions from anon, authenticated;
grant all on table public.contact_submissions to service_role;
grant usage, select on sequence public.contact_submissions_id_seq to service_role;

create table if not exists public.sales_opportunities (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  company_name text not null check (char_length(btrim(company_name)) between 1 and 160),
  stage text not null check (stage in ('Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost')),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  profit_amount numeric(14, 2) not null default 0 check (profit_amount >= 0),
  loss_amount numeric(14, 2) not null default 0 check (loss_amount >= 0),
  owner_name text not null,
  owner_email text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((stage in ('Closed Won', 'Closed Lost')) = (closed_at is not null))
);

alter table public.sales_opportunities
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists sales_opportunities_stage_idx
  on public.sales_opportunities (stage);

create index if not exists sales_opportunities_closed_at_idx
  on public.sales_opportunities (closed_at desc);

create index if not exists sales_opportunities_user_stage_idx
  on public.sales_opportunities (user_id, stage);

create table if not exists public.sales_activities (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  activity_type text not null check (
    activity_type in (
      'New lead added',
      'Discovery call completed',
      'Proposal sent',
      'Follow-up scheduled',
      'Deal won',
      'Deal lost'
    )
  ),
  company_name text not null,
  owner_name text not null,
  owner_email text not null,
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

alter table public.sales_activities
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists sales_activities_created_at_idx
  on public.sales_activities (created_at desc);

alter table public.sales_opportunities enable row level security;
alter table public.sales_activities enable row level security;
revoke all on table public.sales_opportunities, public.sales_activities from anon, authenticated;
grant all on table public.sales_opportunities, public.sales_activities to service_role;
grant usage, select on sequence public.sales_opportunities_id_seq, public.sales_activities_id_seq to service_role;
grant select, insert on table public.sales_opportunities to authenticated;

drop policy if exists sales_opportunities_select_own on public.sales_opportunities;
create policy sales_opportunities_select_own
  on public.sales_opportunities for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists sales_opportunities_insert_own on public.sales_opportunities;
create policy sales_opportunities_insert_own
  on public.sales_opportunities for insert to authenticated
  with check (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
