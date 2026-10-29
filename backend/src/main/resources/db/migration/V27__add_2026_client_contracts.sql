-- Additional contracts; retain the existing 2025 contracts.
with requested(client_name, contract_name) as (
    values
        ('ООО "Хаир"', 'ОП-160/26'),
        ('ООО "Опт-Логистика"', 'ОП-330/26'),
        ('ООО "Мангуст"', 'ОП-220/26')
)
insert into contract (id, client_id, name)
select gen_random_uuid(), c.id, requested.contract_name
from requested
join client c on c.code = requested.client_name
on conflict (client_id, name) do nothing;
