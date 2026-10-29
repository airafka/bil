alter table shipping_order
    add column filling_type varchar(32) not null default 'ALL';

alter table shipping_order
    add constraint ck_shipping_order_filling_type
        check (filling_type in ('ALL', 'RAILWAY_CARRIAGE', 'CONTAINER', 'NONE'));

create table railway_carriage_type (
    id uuid primary key,
    code varchar(100) not null,
    name varchar(200) not null,
    constraint ck_railway_carriage_type_code_not_blank check (btrim(code) <> ''),
    constraint ck_railway_carriage_type_name_not_blank check (btrim(name) <> '')
);

create unique index uq_railway_carriage_type_code_ci
    on railway_carriage_type(lower(btrim(code)));

create table shipping_order_railway_carriage_new (
    id uuid primary key,
    shipping_order_id uuid not null references shipping_order(id) on delete cascade,
    railway_carriage_id uuid not null references railway_carriage(id) on delete restrict,
    constraint uq_shipping_order_numbered_carriage unique (shipping_order_id, railway_carriage_id),
    constraint uq_shipping_order_numbered_carriage_order_and_id unique (shipping_order_id, id)
);

insert into shipping_order_railway_carriage_new (id, shipping_order_id, railway_carriage_id)
select gen_random_uuid(), shipping_order_id, railway_carriage_id
from shipping_order_railway_carriage
group by shipping_order_id, railway_carriage_id;

alter table shipping_order_container
    add column shipping_order_railway_carriage_id uuid;

update shipping_order_container container_row
set shipping_order_railway_carriage_id = numbered_carriage.id
from shipping_order_railway_carriage old_link
join shipping_order_railway_carriage_new numbered_carriage
  on numbered_carriage.shipping_order_id = old_link.shipping_order_id
 and numbered_carriage.railway_carriage_id = old_link.railway_carriage_id
where old_link.shipping_order_container_id = container_row.id
  and old_link.shipping_order_id = container_row.shipping_order_id;

drop table shipping_order_railway_carriage;
alter table shipping_order_railway_carriage_new rename to shipping_order_railway_carriage;

alter table shipping_order_container
    add constraint fk_shipping_order_container_numbered_carriage
        foreign key (shipping_order_id, shipping_order_railway_carriage_id)
            references shipping_order_railway_carriage(shipping_order_id, id)
            on delete set null (shipping_order_railway_carriage_id);

create index ix_shipping_order_numbered_carriage_order_id
    on shipping_order_railway_carriage(shipping_order_id);
create index ix_shipping_order_numbered_carriage_reference_id
    on shipping_order_railway_carriage(railway_carriage_id);
create index ix_shipping_order_container_numbered_carriage_id
    on shipping_order_container(shipping_order_railway_carriage_id);

create table shipping_order_railway_carriage_qty (
    id uuid primary key,
    shipping_order_id uuid not null references shipping_order(id) on delete cascade,
    quantity integer not null,
    type_id uuid references railway_carriage_type(id) on delete restrict,
    constraint ck_shipping_order_carriage_qty_positive check (quantity > 0),
    constraint uq_shipping_order_carriage_qty_type
        unique nulls not distinct (shipping_order_id, type_id)
);

create index ix_shipping_order_carriage_qty_order_id
    on shipping_order_railway_carriage_qty(shipping_order_id);
create index ix_shipping_order_carriage_qty_type_id
    on shipping_order_railway_carriage_qty(type_id);

create table shipping_order_container_qty (
    id uuid primary key,
    shipping_order_id uuid not null references shipping_order(id) on delete cascade,
    quantity integer not null,
    type varchar(20) not null,
    empty boolean not null default false,
    constraint ck_shipping_order_container_qty_positive check (quantity > 0),
    constraint ck_shipping_order_container_qty_type check (type in (
        'REFRIGERATOR_20', 'REFRIGERATOR_40',
        'STANDARD_20', 'STANDARD_40',
        'TANK_20', 'TANK_40'
    ))
);

create index ix_shipping_order_container_qty_order_id
    on shipping_order_container_qty(shipping_order_id);
create unique index uq_shipping_order_empty_container_qty_type
    on shipping_order_container_qty(shipping_order_id, type)
    where empty;

create table shipping_order_etsng_code (
    id uuid primary key,
    shipping_order_container_qty_id uuid not null
        references shipping_order_container_qty(id) on delete cascade,
    etsng_code_id uuid not null references etsng_code(id) on delete restrict,
    weight numeric(16, 3) not null,
    constraint ck_shipping_order_etsng_weight_positive check (weight > 0),
    constraint uq_shipping_order_etsng_row
        unique (shipping_order_container_qty_id, etsng_code_id, weight)
);

create index ix_shipping_order_etsng_container_qty_id
    on shipping_order_etsng_code(shipping_order_container_qty_id);
create index ix_shipping_order_etsng_code_id
    on shipping_order_etsng_code(etsng_code_id);
