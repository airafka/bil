create table container (
    id uuid primary key,
    code varchar(100) not null,
    tare_weight numeric(16,3) not null default 3200.000 check (tare_weight > 0),
    constraint ck_container_code_not_blank check (btrim(code) <> '')
);

create table railway_carriage (
    id uuid primary key,
    code varchar(100) not null,
    constraint ck_railway_carriage_code_not_blank check (btrim(code) <> '')
);

create table client (
    id uuid primary key,
    code varchar(100) not null,
    constraint ck_client_code_not_blank check (btrim(code) <> '')
);

create table etsng_code (
    id uuid primary key,
    code varchar(100) not null,
    constraint ck_etsng_code_code_not_blank check (btrim(code) <> '')
);

create table receiving_order (
    id uuid primary key,
    code integer generated always as identity,
    client_id uuid not null references client(id) on delete restrict,
    status varchar(100) not null,
    constraint uq_receiving_order_code unique (code),
    constraint ck_receiving_order_status check (status in ('DRAFT'))
);

create table receiving_order_container (
    id uuid primary key,
    receiving_order_id uuid not null references receiving_order(id) on delete cascade,
    container_id uuid not null references container(id) on delete restrict,
    empty boolean not null default false,
    constraint uq_receiving_order_container unique (receiving_order_id, container_id)
);

create table receiving_order_container_item (
    id uuid primary key,
    receiving_order_container_id uuid not null references receiving_order_container(id) on delete cascade,
    etsng_code_id uuid not null references etsng_code(id) on delete restrict,
    weight numeric(15, 3) not null,
    constraint uq_receiving_order_container_item unique (receiving_order_container_id),
    constraint ck_receiving_order_item_weight_positive check (weight > 0)
);

create table shipping_order (
    id uuid primary key,
    code integer generated always as identity,
    client_id uuid not null references client(id) on delete restrict,
    status varchar(100) not null,
    constraint uq_shipping_order_code unique (code),
    constraint ck_shipping_order_status check (status in ('DRAFT'))
);

create table shipping_order_container (
    id uuid primary key,
    shipping_order_id uuid not null references shipping_order(id) on delete cascade,
    container_id uuid not null references container(id) on delete restrict,
    empty boolean not null default false,
    constraint uq_shipping_order_container unique (shipping_order_id, container_id)
);

create table shipping_order_container_item (
    id uuid primary key,
    shipping_order_container_id uuid not null references shipping_order_container(id) on delete cascade,
    etsng_code_id uuid not null references etsng_code(id) on delete restrict,
    weight numeric(15, 3) not null,
    constraint uq_shipping_order_container_item unique (shipping_order_container_id),
    constraint ck_shipping_order_item_weight_positive check (weight > 0)
);

create index ix_receiving_order_client_id on receiving_order(client_id);
create index ix_receiving_order_code_desc on receiving_order(code desc);
create index ix_receiving_order_container_order_id on receiving_order_container(receiving_order_id);
create index ix_receiving_order_container_container_id on receiving_order_container(container_id);
create index ix_receiving_order_item_etsng_code_id on receiving_order_container_item(etsng_code_id);

create index ix_shipping_order_client_id on shipping_order(client_id);
create index ix_shipping_order_code_desc on shipping_order(code desc);
create index ix_shipping_order_container_order_id on shipping_order_container(shipping_order_id);
create index ix_shipping_order_container_container_id on shipping_order_container(container_id);
create index ix_shipping_order_item_etsng_code_id on shipping_order_container_item(etsng_code_id);

create unique index uq_container_code_ci on container(lower(code));
create unique index uq_railway_carriage_code_ci on railway_carriage(lower(code));
create unique index uq_client_code_ci on client(lower(code));
create unique index uq_etsng_code_code_ci on etsng_code(lower(code));
