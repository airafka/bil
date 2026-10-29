alter table receiving_order
    add column service_role varchar(30) not null default 'INITIAL_RECEIVING',
    add column source_shipping_order_id uuid,
    add column return_container_id uuid references container(id) on delete restrict;

alter table receiving_order drop constraint receiving_order_service_order_id_key;
alter table receiving_order drop constraint ck_receiving_service_transport;
alter table receiving_order add constraint ck_receiving_service_role check (
    (service_order_id is null and service_role = 'INITIAL_RECEIVING'
        and source_shipping_order_id is null and return_container_id is null)
    or (service_order_id is not null and service_role = 'INITIAL_RECEIVING'
        and transport_type = 'RAILWAY' and source_shipping_order_id is null and return_container_id is null)
    or (service_order_id is not null and service_role = 'RETURN_RECEIVING'
        and transport_type = 'VEHICLE' and source_shipping_order_id is not null and return_container_id is not null)
);
create unique index uq_receiving_initial_per_service on receiving_order(service_order_id)
    where service_order_id is not null and service_role = 'INITIAL_RECEIVING';
create unique index uq_receiving_return_per_container
    on receiving_order(source_shipping_order_id, return_container_id)
    where service_role = 'RETURN_RECEIVING';
alter table receiving_order add constraint fk_receiving_return_source
    foreign key (source_shipping_order_id, service_order_id)
    references shipping_order(id, service_order_id) on delete restrict;
