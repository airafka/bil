-- Optional attributes of a container in a vehicle receiving order.
-- Catalogs deliberately start empty; existing business data is preserved.
create table seal_type (
    id uuid primary key,
    code varchar(255) not null unique
);
create table hazard_class (
    id uuid primary key,
    code varchar(255) not null unique
);
alter table receiving_order_container
    add column owner_client_id uuid references client(id) on delete restrict,
    add column seal_numbers varchar(1000),
    add column seal_type_id uuid references seal_type(id) on delete restrict,
    add column hazard_class_id uuid references hazard_class(id) on delete restrict;
