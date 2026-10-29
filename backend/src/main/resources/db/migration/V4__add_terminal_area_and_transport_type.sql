create table terminal_area_catalog (
    id uuid primary key,
    code varchar(100) not null,
    name varchar(255) not null,
    constraint ck_terminal_area_code_not_blank check (btrim(code) <> ''),
    constraint ck_terminal_area_name_not_blank check (btrim(name) <> ''),
    constraint ck_terminal_area_code_trimmed check (code = btrim(code)),
    constraint ck_terminal_area_name_trimmed check (name = btrim(name)),
    constraint uq_terminal_area_code unique (code)
);

insert into terminal_area_catalog (id, code, name)
values ('50000000-0000-0000-0000-000000000001', 'CONTAINER', 'Контейнерная площадка');

alter table receiving_order
    add column terminal_area_catalog_id uuid,
    add column transport_type varchar(100);

alter table shipping_order
    add column terminal_area_catalog_id uuid,
    add column transport_type varchar(100);

update receiving_order
set terminal_area_catalog_id = (
    select id from terminal_area_catalog where code = 'CONTAINER'
)
where terminal_area_catalog_id is null;

update shipping_order
set terminal_area_catalog_id = (
    select id from terminal_area_catalog where code = 'CONTAINER'
)
where terminal_area_catalog_id is null;

alter table receiving_order
    alter column terminal_area_catalog_id set not null,
    add constraint fk_receiving_order_terminal_area
        foreign key (terminal_area_catalog_id) references terminal_area_catalog(id) on delete restrict,
    add constraint ck_receiving_order_transport_type
        check (transport_type is not null and transport_type in ('VEHICLE', 'RAILWAY')) not valid;

alter table shipping_order
    alter column terminal_area_catalog_id set not null,
    alter column transport_type set not null,
    add constraint fk_shipping_order_terminal_area
        foreign key (terminal_area_catalog_id) references terminal_area_catalog(id) on delete restrict,
    add constraint ck_shipping_order_transport_type
        check (transport_type in ('VEHICLE', 'RAILWAY'));

create index ix_receiving_order_terminal_area_id on receiving_order(terminal_area_catalog_id);
create index ix_shipping_order_terminal_area_id on shipping_order(terminal_area_catalog_id);
