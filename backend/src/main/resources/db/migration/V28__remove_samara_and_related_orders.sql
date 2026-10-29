-- Requested removal of the local client and its orders. Preserve waybills.
-- Prevent concurrent requests from adding new references to this client during cleanup.
do $$
begin
    perform id from client where code = 'Самара' for update;
end $$;

update waybill
set receiving_order_id = null
where receiving_order_id in (
    select r.id from receiving_order r join client c on c.id = r.client_id
    where c.code = 'Самара'
);

delete from shipping_order
where client_id in (select id from client where code = 'Самара');

delete from receiving_order
where client_id in (select id from client where code = 'Самара');

delete from service_order
where client_id in (select id from client where code = 'Самара');

delete from contract
where client_id in (select id from client where code = 'Самара');

delete from client where code = 'Самара';
