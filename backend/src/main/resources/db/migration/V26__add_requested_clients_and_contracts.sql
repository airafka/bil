-- Local reference entries requested on 2026-10-27.
with requested(name) as (
    values ('ООО "Хаир"'), ('ООО "Опт-Логистика"'), ('ООО "Мангуст"')
)
insert into client (id, code)
select gen_random_uuid(), requested.name
from requested
where not exists (select 1 from client c where c.code = requested.name);

with requested(client_name, contract_name) as (
    values
        ('ООО "Хаир"', 'ОП-160/25'),
        ('ООО "Опт-Логистика"', 'ОП-330/25'),
        ('ООО "Мангуст"', 'ОП-220/25')
)
insert into contract (id, client_id, name)
select gen_random_uuid(), c.id, requested.contract_name
from requested
join client c on c.code = requested.client_name
on conflict (client_id, name) do nothing;
