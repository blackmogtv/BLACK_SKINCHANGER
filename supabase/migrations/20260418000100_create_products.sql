create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    client_id text not null unique,
    display_name text not null,
    description text not null default '',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists products_is_active_idx on public.products (is_active);
create index if not exists products_created_at_idx on public.products (created_at desc);

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row
execute function public.touch_updated_at();

alter table public.products enable row level security;

drop policy if exists products_no_direct_access on public.products;
create policy products_no_direct_access
on public.products
for all
using (false)
with check (false);

insert into public.products (client_id, display_name, description)
values
    ('BLACK_MACRO', 'BLACK_MACRO', 'Product record for BLACK_MACRO'),
    ('BLACK_TRIGGERBOT', 'BLACK_TRIGGERBOT', 'Product record for BLACK_TRIGGERBOT'),
    ('BLACK_SKINCHANGER', 'BLACK_SKINCHANGER', 'Product record for BLACK_SKINCHANGER')
on conflict (client_id) do update
set
    display_name = excluded.display_name,
    description = excluded.description,
    is_active = true;
