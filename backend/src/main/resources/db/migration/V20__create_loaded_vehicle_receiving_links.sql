alter table receiving_order
    drop constraint if exists uq_receiving_order_service_stage;

alter table receiving_order
    add column source_shipping_order_id uuid,
    add constraint fk_receiving_order_source_shipping_order
        foreign key (source_shipping_order_id) references shipping_order(id) on delete restrict;

create index ix_receiving_order_service_stage
    on receiving_order(service_order_id, complex_service_stage_id);

create unique index uq_receiving_order_source_shipping_order
    on receiving_order(source_shipping_order_id)
    where source_shipping_order_id is not null;
