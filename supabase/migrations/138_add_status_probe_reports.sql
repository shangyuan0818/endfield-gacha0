-- STATUS-001: VPS probe latest reports for the hidden status admin page.
create table if not exists public.status_probe_reports (
  probe_id text primary key,
  label text not null,
  region text,
  status text not null default 'unknown',
  summary text,
  reported_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_status_probe_reports_status
  on public.status_probe_reports (status);

create index if not exists idx_status_probe_reports_reported_at
  on public.status_probe_reports (reported_at desc);

create or replace function public.set_status_probe_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_status_probe_reports_updated_at on public.status_probe_reports;
create trigger trg_status_probe_reports_updated_at
before update on public.status_probe_reports
for each row
execute function public.set_status_probe_reports_updated_at();

alter table public.status_probe_reports enable row level security;

revoke all on table public.status_probe_reports from anon;
revoke all on table public.status_probe_reports from authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on table public.status_probe_reports to service_role;
  end if;
end;
$$;
