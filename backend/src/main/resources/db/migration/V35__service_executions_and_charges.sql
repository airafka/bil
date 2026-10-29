alter table complex_service_catalog add column purpose varchar(30) unique
    check (purpose in ('A_TRAIN', 'A_WAGON', 'B_AUTO_RETURN'));
update complex_service_catalog set purpose = case btrim(name)
    when 'Комплексная услуга по приему контейнера в составе поезда' then 'A_TRAIN'
    when 'Комплексная услуга по приему контейнера при повагонной отправке' then 'A_WAGON'
    when 'Комплексная услуга по приему контейнера, прибывшего автотранспортом' then 'B_AUTO_RETURN'
    else null end;

alter table receiving_order
    add column accepted_container_count integer check (accepted_container_count > 0),
    add column a_complex_service_id uuid references complex_service_catalog(id) on delete restrict,
    add column acceptance_fixed_at timestamptz;

create table service_execution (
    id uuid primary key,
    service_order_id uuid not null references service_order(id) on delete restrict,
    container_id uuid not null references container(id) on delete restrict,
    family varchar(1) not null check (family in ('A','B')),
    complex_service_id uuid not null references complex_service_catalog(id) on delete restrict,
    receiving_order_id uuid not null,
    shipping_order_id uuid not null,
    status varchar(20) not null check (status in ('PLANNED','PERFORMED')),
    performed_at timestamptz,
    tariff_id uuid references complex_service_tariff(id) on delete restrict,
    coefficient numeric(12,4),
    base_price_without_vat numeric(14,2),
    base_price_with_vat numeric(14,2),
    price_without_vat numeric(14,2),
    price_with_vat numeric(14,2),
    priced_at timestamptz,
    accepted_container_count integer,
    unique(service_order_id, container_id, family),
    foreign key(receiving_order_id, service_order_id) references receiving_order(id, service_order_id) on delete restrict,
    foreign key(shipping_order_id, service_order_id) references shipping_order(id, service_order_id) on delete restrict,
    check ((priced_at is null and tariff_id is null and coefficient is null and base_price_without_vat is null
            and base_price_with_vat is null and price_without_vat is null and price_with_vat is null)
        or (priced_at is not null and tariff_id is not null and coefficient > 0 and base_price_without_vat >= 0
            and base_price_with_vat >= base_price_without_vat and price_without_vat >= 0 and price_with_vat >= price_without_vat)),
    check(status <> 'PERFORMED' or (performed_at is not null and priced_at is not null))
);
create table billing_charge (
    id uuid primary key,
    service_execution_id uuid not null unique references service_execution(id) on delete restrict,
    client_id uuid not null,
    contract_id uuid not null,
    performed_at timestamptz not null,
    quantity integer not null default 1 check(quantity = 1),
    price_without_vat numeric(14,2) not null check(price_without_vat >= 0),
    amount_without_vat numeric(14,2) not null,
    price_with_vat numeric(14,2) not null check(price_with_vat >= price_without_vat),
    amount_with_vat numeric(14,2) not null,
    currency varchar(3) not null default 'RUB' check(currency = 'RUB'),
    created_at timestamptz not null default current_timestamp,
    foreign key(contract_id, client_id) references contract(id, client_id) on delete restrict,
    check(amount_without_vat = price_without_vat and amount_with_vat = price_with_vat)
);
create index ix_execution_service on service_execution(service_order_id);
create index ix_charge_date on billing_charge(performed_at);
-- Historical COMPLETED orders are deliberately not processed by this migration.
