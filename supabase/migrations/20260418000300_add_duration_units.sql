alter table public.license_keys
add column if not exists duration_value integer check (duration_value is null or duration_value > 0),
add column if not exists duration_unit text check (
    duration_unit is null or duration_unit in ('hours', 'days', 'weeks', 'months', 'years')
);

update public.license_keys
set
    duration_value = coalesce(duration_value, duration_days),
    duration_unit = case
        when duration_value is not null then duration_unit
        when duration_days is not null then 'days'
        else duration_unit
    end
where duration_value is null or duration_unit is null;

create or replace function public.set_license_key_expiration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.duration_value is null or new.duration_unit is null then
        if new.duration_days is null then
            new.duration_value = null;
            new.duration_unit = null;
            new.expires_at = null;
            return new;
        end if;

        new.duration_value = new.duration_days;
        new.duration_unit = 'days';
    end if;

    if new.duration_value <= 0 then
        raise exception 'duration_value must be positive';
    end if;

    case new.duration_unit
        when 'hours' then
            new.duration_days = null;
            new.expires_at = coalesce(new.created_at, now()) + make_interval(hours => new.duration_value);
        when 'days' then
            new.duration_days = new.duration_value;
            new.expires_at = coalesce(new.created_at, now()) + make_interval(days => new.duration_value);
        when 'weeks' then
            new.duration_days = new.duration_value * 7;
            new.expires_at = coalesce(new.created_at, now()) + make_interval(weeks => new.duration_value);
        when 'months' then
            new.duration_days = null;
            new.expires_at = coalesce(new.created_at, now()) + make_interval(months => new.duration_value);
        when 'years' then
            new.duration_days = null;
            new.expires_at = coalesce(new.created_at, now()) + make_interval(years => new.duration_value);
        else
            raise exception 'unsupported duration_unit: %', new.duration_unit;
    end case;

    return new;
end;
$$;

drop trigger if exists license_keys_set_expiration on public.license_keys;
create trigger license_keys_set_expiration
before insert or update of duration_days, duration_value, duration_unit, created_at on public.license_keys
for each row
execute function public.set_license_key_expiration();

comment on column public.license_keys.duration_value is 'Positive duration amount paired with duration_unit; null means lifetime.';
comment on column public.license_keys.duration_unit is 'Exact duration unit for expiry calculation; null means lifetime.';
