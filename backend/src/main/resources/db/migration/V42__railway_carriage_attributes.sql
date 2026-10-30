create table railway_carriage_model (
    id uuid primary key,
    code varchar(255) not null unique
);
-- Reuse the existing carriage-type catalog, preserving all historical entries.
alter table railway_carriage
    add column model_id uuid references railway_carriage_model(id) on delete restrict,
    add column load_capacity numeric(15,3) check (load_capacity > 0),
    add column next_depot_repair_date date,
    add column carriage_type_id uuid references railway_carriage_type(id) on delete restrict;
