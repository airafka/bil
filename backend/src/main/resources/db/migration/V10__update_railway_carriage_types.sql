update railway_carriage_type
set code = 'PLATFORM_40',
    name = 'Платформа 40 футов'
where id = 'a1000000-0000-0000-0000-000000000001'::uuid;

insert into railway_carriage_type (id, code, name)
select 'a1000000-0000-0000-0000-000000000002'::uuid, 'PLATFORM_60', 'Платформа 60 футов'
where not exists (
    select 1 from railway_carriage_type where lower(btrim(code)) = lower('PLATFORM_60')
);

insert into railway_carriage_type (id, code, name)
select 'a1000000-0000-0000-0000-000000000003'::uuid, 'PLATFORM_80', 'Платформа 80 футов'
where not exists (
    select 1 from railway_carriage_type where lower(btrim(code)) = lower('PLATFORM_80')
);
