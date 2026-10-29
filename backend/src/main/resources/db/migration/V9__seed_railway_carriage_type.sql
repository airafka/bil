insert into railway_carriage_type (id, code, name)
select 'a1000000-0000-0000-0000-000000000001'::uuid, 'FITTING_PLATFORM', 'Фитинговая платформа'
where not exists (
    select 1 from railway_carriage_type where lower(btrim(code)) = lower('FITTING_PLATFORM')
);
