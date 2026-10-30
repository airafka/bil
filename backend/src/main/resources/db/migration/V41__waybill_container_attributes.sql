alter table waybill_container
    add column owner_client_id uuid references client(id) on delete restrict,
    add column seal_numbers varchar(1000),
    add column seal_type_id uuid references seal_type(id) on delete restrict;
