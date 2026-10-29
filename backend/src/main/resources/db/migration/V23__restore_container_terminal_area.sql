insert into terminal_area_catalog (id, code, name)
values ('50000000-0000-0000-0000-000000000001', 'CONTAINER', 'Контейнерная площадка')
on conflict (code) do update
set name = excluded.name;
