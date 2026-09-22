-- Safe reference data required by RF-06.
-- This may be run repeatedly.
insert into public.brands (name)
values ('Del local')
on conflict (name) do nothing;
