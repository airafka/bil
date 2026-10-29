create table waybill (
    id uuid primary key,
    number varchar(255) not null,
    receiving_order_id uuid references receiving_order(id) on delete restrict,
    departure_station integer not null,
    destination_station integer not null,
    payer varchar(255) not null,
    constraint ck_waybill_number_not_blank check (btrim(number) <> ''),
    constraint ck_waybill_number_trimmed check (number = btrim(number)),
    constraint ck_waybill_payer_not_blank check (btrim(payer) <> ''),
    constraint ck_waybill_payer_trimmed check (payer = btrim(payer))
);

create table waybill_railway_carriage (
    id uuid primary key,
    waybill_id uuid not null references waybill(id) on delete cascade,
    railway_carriage_id uuid not null references railway_carriage(id) on delete restrict
);

create table waybill_container (
    id uuid primary key,
    waybill_railway_carriage_id uuid not null references waybill_railway_carriage(id) on delete cascade,
    container_id uuid not null references container(id) on delete restrict,
    gross_weight numeric(16,3) not null check (gross_weight > 0)
);

create table waybill_product (
    id uuid primary key,
    waybill_id uuid not null references waybill(id) on delete cascade,
    waybill_container_id uuid not null unique references waybill_container(id) on delete cascade,
    etsng_code_id uuid not null references etsng_code(id) on delete restrict
);

create index ix_waybill_receiving_order_id on waybill(receiving_order_id);
create index ix_waybill_group on waybill(departure_station, destination_station, payer);
create index ix_waybill_railway_carriage_waybill_id on waybill_railway_carriage(waybill_id);
create index ix_waybill_container_carriage_id on waybill_container(waybill_railway_carriage_id);
create index ix_waybill_product_waybill_id on waybill_product(waybill_id);
