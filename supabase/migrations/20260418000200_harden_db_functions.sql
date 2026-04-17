create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.set_license_key_expiration()
returns trigger
language plpgsql
set search_path = ''
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
