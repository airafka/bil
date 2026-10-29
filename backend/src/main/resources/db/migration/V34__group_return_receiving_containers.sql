-- Keep existing return orders and their compositions intact.
alter table receiving_order drop constraint ck_receiving_service_role;
drop index uq_receiving_return_per_container;
alter table receiving_order drop column return_container_id;
alter table receiving_order add constraint ck_receiving_service_role check (
    (service_order_id is null and service_role = 'INITIAL_RECEIVING' and source_shipping_order_id is null)
    or (service_order_id is not null and service_role = 'INITIAL_RECEIVING'
        and transport_type = 'RAILWAY' and source_shipping_order_id is null)
    or (service_order_id is not null and service_role = 'RETURN_RECEIVING'
        and transport_type = 'VEHICLE' and source_shipping_order_id is not null)
);
create unique index uq_receiving_return_per_shipping on receiving_order(source_shipping_order_id)
    where service_role = 'RETURN_RECEIVING';
