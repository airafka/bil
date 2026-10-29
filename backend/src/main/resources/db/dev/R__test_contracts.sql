insert into contract (id, client_id, name)
select gen_random_uuid(), id, 'Тестовый договор № 1' from client
on conflict (client_id, name) do nothing;
