-- The previous one-container-per-vehicle service orders are disposable in this local MVP.
update waybill set receiving_order_id = null where receiving_order_id is not null;
delete from shipping_order;
delete from receiving_order;
delete from service_order;

alter sequence shipping_order_code_seq restart with 1;
alter sequence receiving_order_code_seq restart with 1;
alter sequence service_order_code_seq restart with 1;

alter table shipping_order drop constraint ck_shipping_service_context;
alter table shipping_order drop column source_container_id;
alter table shipping_order add constraint ck_shipping_service_context check (
    (service_order_id is null and source_receiving_order_id is null)
    or (service_order_id is not null and source_receiving_order_id is not null
        and contract_id is not null and transport_type = 'VEHICLE' and filling_type = 'ALL')
);
alter table shipping_order add constraint uq_shipping_order_id_service unique (id, service_order_id);

create table shipping_order_source_container (
    shipping_order_id uuid not null,
    service_order_id uuid not null,
    container_id uuid not null references container(id) on delete restrict,
    primary key (shipping_order_id, container_id),
    unique (service_order_id, container_id),
    foreign key (shipping_order_id, service_order_id)
        references shipping_order(id, service_order_id) on delete cascade
);
create index ix_shipping_order_source_container_container
    on shipping_order_source_container(container_id);
