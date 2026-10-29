insert into railway_carriage (id, code)
select gen_random_uuid(), source.code
from (values
    ('91271197'),
    ('91775155'),
    ('91635193'),
    ('91719666'),
    ('98172661'),
    ('98502990'),
    ('91745075'),
    ('91751941'),
    ('98184906'),
    ('91713453'),
    ('91677492'),
    ('98502677'),
    ('91775106'),
    ('98184310'),
    ('98503907')
) as source(code)
where not exists (
    select 1
    from railway_carriage existing
    where lower(btrim(existing.code)) = lower(btrim(source.code))
);

insert into container (id, code)
select gen_random_uuid(), source.code
from (values
    ('TKRU4468123'),
    ('AKMU4002966'),
    ('TKRU4694223'),
    ('TKRU4483344'),
    ('TKRU4052985'),
    ('AKMU4008413'),
    ('DLRU0104292'),
    ('TKRU4042626'),
    ('TKRU4696102'),
    ('TKRU4095333'),
    ('TKRU4004518'),
    ('TKRU4520453'),
    ('DLRU0031010'),
    ('TKRU4661600'),
    ('TKRU4681479')
) as source(code)
where not exists (
    select 1
    from container existing
    where lower(btrim(existing.code)) = lower(btrim(source.code))
);
