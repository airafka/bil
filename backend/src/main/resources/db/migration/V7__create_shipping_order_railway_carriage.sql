alter table shipping_order_container
    add constraint uq_shipping_order_container_order_and_id
        unique (shipping_order_id, id);

create table shipping_order_railway_carriage (
    id uuid primary key,
    shipping_order_id uuid not null,
    railway_carriage_id uuid not null,
    shipping_order_container_id uuid not null,
    constraint fk_shipping_railway_order
        foreign key (shipping_order_id) references shipping_order(id) on delete cascade,
    constraint fk_shipping_railway_carriage
        foreign key (railway_carriage_id) references railway_carriage(id) on delete restrict,
    constraint fk_shipping_railway_order_container
        foreign key (shipping_order_id, shipping_order_container_id)
            references shipping_order_container(shipping_order_id, id) on delete cascade,
    constraint uq_shipping_railway_order_container
        unique (shipping_order_id, shipping_order_container_id)
);

create index ix_shipping_railway_order_id
    on shipping_order_railway_carriage(shipping_order_id);

create index ix_shipping_railway_carriage_id
    on shipping_order_railway_carriage(railway_carriage_id);

create index ix_shipping_railway_order_container_id
    on shipping_order_railway_carriage(shipping_order_container_id);
