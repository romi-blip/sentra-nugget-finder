
-- 1) Events table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  details text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_event_dates check (end_date >= start_date)
);

-- Trigger to auto-update updated_at on events
drop trigger if exists set_updated_at on public.events;
create trigger set_updated_at
before update on public.events
for each row execute function public.update_updated_at_column();

-- Enable RLS and policies for events
alter table public.events enable row level security;

drop policy if exists "Admins can manage events" on public.events;
create policy "Admins can manage events"
on public.events
for all
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

-- 2) Event leads table
create table if not exists public.event_leads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  -- Lead fields
  lead_status text,
  first_name text not null,
  last_name text not null,
  email text not null,
  account_name text not null,
  title text,
  lead_exclusion_field text,
  mailing_street text,
  mailing_city text,
  mailing_state_province text,
  mailing_zip_postal_code text,
  mailing_country text,
  notes text,
  phone text,
  mobile text,
  email_opt_out boolean not null default false,
  linkedin text,
  latest_lead_source text,
  latest_lead_source_details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_event_lead unique (event_id, email)
);

-- Indexes for performance
create index if not exists idx_event_leads_event_id on public.event_leads(event_id);
create index if not exists idx_event_leads_email on public.event_leads(email);

-- Trigger to auto-update updated_at on event_leads
drop trigger if exists set_updated_at on public.event_leads;
create trigger set_updated_at
before update on public.event_leads
for each row execute function public.update_updated_at_column();

-- Enable RLS and policies for event_leads
alter table public.event_leads enable row level security;

drop policy if exists "Admins can manage event leads" on public.event_leads;
create policy "Admins can manage event leads"
on public.event_leads
for all
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));
