create table if not exists public.validation_attempts (
    id uuid primary key default gen_random_uuid(),
    client_id text,
    submitted_license_key text,
    submitted_key_hash text,
    matched_license_key_id uuid references public.license_keys(id) on delete set null,
    is_valid boolean not null,
    reason text not null,
    status_returned text not null,
    hwid text,
    hwid_hash text,
    user_label text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists validation_attempts_created_at_idx
on public.validation_attempts (created_at desc);

create index if not exists validation_attempts_client_id_created_at_idx
on public.validation_attempts (client_id, created_at desc);

create index if not exists validation_attempts_matched_license_key_id_idx
on public.validation_attempts (matched_license_key_id, created_at desc);

create index if not exists validation_attempts_submitted_key_hash_idx
on public.validation_attempts (submitted_key_hash);

alter table public.validation_attempts enable row level security;

drop policy if exists validation_attempts_no_direct_access on public.validation_attempts;
create policy validation_attempts_no_direct_access
on public.validation_attempts
for all
using (false)
with check (false);

comment on table public.validation_attempts is 'Audit log of every validation attempt, including wrong keys and mismatch reasons.';
comment on column public.validation_attempts.reason is 'Normalized backend reason such as invalid_key, hwid_mismatch, expired, banned, unknown_product, inactive_product, or valid_* outcomes.';
