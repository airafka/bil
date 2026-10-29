create table contract (
    id uuid primary key,
    client_id uuid not null references client(id) on delete restrict,
    name varchar(255) not null check (btrim(name) <> '' and name = btrim(name)),
    unique (client_id, name),
    unique (id, client_id)
);

-- Requested local test contracts, including clients already present in the local DB.
insert into contract(id, client_id, name)
select gen_random_uuid(), id, 'Тестовый договор № 1' from client;

create table service_order (
    id uuid primary key,
    code integer generated always as identity unique,
    client_id uuid not null references client(id) on delete restrict,
    contract_id uuid not null,
    status varchar(30) not null default 'DRAFT' check (status = 'DRAFT'),
    created_at timestamptz not null default current_timestamp,
    foreign key (contract_id, client_id) references contract(id, client_id) on delete restrict,
    unique (id, client_id, contract_id)
);

alter table receiving_order
    drop column driver_full_name,
    drop column vehicle_number,
    add column contract_id uuid,
    add column service_order_id uuid,
    add foreign key (contract_id, client_id) references contract(id, client_id) on delete restrict,
    add foreign key (service_order_id, client_id, contract_id)
        references service_order(id, client_id, contract_id) on delete restrict,
    add constraint ck_receiving_service_contract check (service_order_id is null or contract_id is not null),
    add constraint ck_receiving_service_transport check (service_order_id is null or transport_type = 'RAILWAY'),
    add unique (service_order_id),
    add unique (id, service_order_id);

alter table shipping_order
    drop column driver_full_name,
    drop column vehicle_number,
    add column contract_id uuid,
    add column service_order_id uuid,
    add column source_receiving_order_id uuid,
    add column source_container_id uuid references container(id) on delete restrict,
    add foreign key (contract_id, client_id) references contract(id, client_id) on delete restrict,
    add foreign key (service_order_id, client_id, contract_id)
        references service_order(id, client_id, contract_id) on delete restrict,
    add foreign key (source_receiving_order_id, service_order_id)
        references receiving_order(id, service_order_id) on delete restrict,
    add constraint ck_shipping_service_context check (
        (service_order_id is null and source_receiving_order_id is null and source_container_id is null)
        or (service_order_id is not null and source_receiving_order_id is not null
            and source_container_id is not null and contract_id is not null
            and transport_type = 'VEHICLE' and filling_type = 'ALL')
    ),
    add unique (service_order_id, source_container_id);

create index ix_receiving_contract on receiving_order(contract_id);
create index ix_shipping_contract on shipping_order(contract_id);
create index ix_shipping_source_receiving on shipping_order(source_receiving_order_id);
create index ix_service_order_code on service_order(code desc);
