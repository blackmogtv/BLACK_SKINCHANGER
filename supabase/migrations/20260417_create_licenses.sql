create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.set_license_key_expiration()
returns trigger
language plpgsql
as $$
begin
    if new.duration_days is null then
        new.expires_at = null;
    else
        new.expires_at = coalesce(new.created_at, now()) + make_interval(days => new.duration_days);
    end if;

    return new;
end;
$$;

create table if not exists public.license_keys (
    id uuid primary key default gen_random_uuid(),
    client_id text not null,
    license_key text not null,
    key_hash text not null,
    status text not null default 'active' check (status in ('active', 'banned')),
    created_by text,
    duration_days integer check (duration_days is null or duration_days > 0),
    expires_at timestamptz,
    first_used_at timestamptz,
    last_used_at timestamptz,
    last_validation_at timestamptz,
    bound_hwid text,
    bound_hwid_hash text,
    bound_user_label text,
    hwid_reset_count integer not null default 0,
    last_hwid_reset_at timestamptz,
    note text not null default '',
    banned_reason text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists license_keys_client_id_key_hash_uidx
on public.license_keys (client_id, key_hash);

create unique index if not exists license_keys_client_id_license_key_uidx
on public.license_keys (client_id, license_key);

create index if not exists license_keys_client_id_idx on public.license_keys (client_id);
create index if not exists license_keys_status_idx on public.license_keys (status);
create index if not exists license_keys_bound_hwid_hash_idx on public.license_keys (bound_hwid_hash);
create index if not exists license_keys_created_at_idx on public.license_keys (created_at desc);

drop trigger if exists license_keys_touch_updated_at on public.license_keys;
create trigger license_keys_touch_updated_at
before update on public.license_keys
for each row
execute function public.touch_updated_at();

drop trigger if exists license_keys_set_expiration on public.license_keys;
create trigger license_keys_set_expiration
before insert or update of duration_days, created_at on public.license_keys
for each row
execute function public.set_license_key_expiration();

create table if not exists public.license_key_events (
    id uuid primary key default gen_random_uuid(),
    license_key_id uuid not null references public.license_keys(id) on delete cascade,
    event_type text not null,
    actor text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists license_key_events_license_key_id_idx
on public.license_key_events (license_key_id, created_at desc);

alter table public.license_keys enable row level security;
alter table public.license_key_events enable row level security;

drop policy if exists license_keys_no_direct_access on public.license_keys;
create policy license_keys_no_direct_access
on public.license_keys
for all
using (false)
with check (false);

drop policy if exists license_key_events_no_direct_access on public.license_key_events;
create policy license_key_events_no_direct_access
on public.license_key_events
for all
using (false)
with check (false);

comment on table public.license_keys is 'License keys and their activation state.';
comment on column public.license_keys.key_hash is 'SHA-256 hash of the normalized license key.';
comment on column public.license_keys.bound_hwid_hash is 'SHA-256 hash of the bound HWID or install identifier.';
comment on table public.license_key_events is 'Audit trail for key creation, validation, ban, note changes, and HWID resets.';
