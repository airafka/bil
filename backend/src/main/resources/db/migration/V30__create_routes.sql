create table route (
    id uuid primary key,
    code integer generated always as identity unique,
    route_type varchar(20) not null check (route_type in ('RECEIVING', 'SHIPPING')),
    departure_at timestamptz not null,
    terminal_area_catalog_id uuid not null references terminal_area_catalog(id) on delete restrict,
    transport_type varchar(20) not null check (transport_type in ('VEHICLE', 'RAILWAY')),
    carrier varchar(255),
    driver_name varchar(255),
    vehicle_number varchar(100),
    comment varchar(200),
    status varchar(20) not null default 'DRAFT' check (status in ('DRAFT', 'CONFIRMED', 'COMPLETED')),
    created_at timestamptz not null default current_timestamp,
    constraint ck_vehicle_route_details check (transport_type <> 'VEHICLE' or
        (carrier is not null and btrim(carrier) <> '' and driver_name is not null and btrim(driver_name) <> ''
         and vehicle_number is not null and btrim(vehicle_number) <> ''))
);

alter table receiving_order add column route_id uuid references route(id) on delete restrict;
alter table shipping_order add column route_id uuid references route(id) on delete restrict;
create index ix_receiving_order_route on receiving_order(route_id);
create index ix_shipping_order_route on shipping_order(route_id);
