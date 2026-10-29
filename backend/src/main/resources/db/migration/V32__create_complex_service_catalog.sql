create table complex_service_catalog (
    id uuid primary key,
    name varchar(255) not null unique check (btrim(name) <> '' and name = btrim(name)),
    price_without_vat numeric(14, 2) not null check (price_without_vat >= 0),
    price_with_vat numeric(14, 2) not null check (price_with_vat >= price_without_vat),
    created_at timestamptz not null default current_timestamp
);

create table complex_service_tariff (
    id uuid primary key,
    complex_service_id uuid not null references complex_service_catalog(id) on delete cascade,
    client_id uuid not null,
    contract_id uuid not null,
    coefficient numeric(12, 4) not null check (coefficient > 0),
    foreign key (contract_id, client_id) references contract(id, client_id) on delete restrict,
    unique (complex_service_id, contract_id)
);
create index ix_complex_service_tariff_client on complex_service_tariff(client_id);
