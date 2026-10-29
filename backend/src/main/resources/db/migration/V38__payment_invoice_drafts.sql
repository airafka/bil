create table payment_invoice (
    id uuid primary key,
    code integer generated always as identity unique,
    request_key uuid not null unique,
    client_id uuid not null references client(id) on delete restrict,
    contract_id uuid not null,
    client_name varchar(255) not null,
    contract_name varchar(255) not null,
    billing_month date not null check (extract(day from billing_month) = 1),
    billing_time_zone varchar(80) not null,
    status varchar(20) not null default 'DRAFT' check (status = 'DRAFT'),
    currency varchar(3) not null check (currency = 'RUB'),
    amount_without_vat numeric(14,2) not null check (amount_without_vat >= 0),
    amount_with_vat numeric(14,2) not null check (amount_with_vat >= amount_without_vat),
    created_at timestamptz not null default current_timestamp,
    foreign key (contract_id, client_id) references contract(id, client_id) on delete restrict
);

create table payment_invoice_line (
    id uuid primary key,
    invoice_id uuid not null references payment_invoice(id) on delete cascade,
    billing_charge_id uuid not null unique references billing_charge(id) on delete restrict,
    performed_at timestamptz not null,
    service_order_id uuid not null references service_order(id) on delete restrict,
    service_order_code integer not null,
    container_name varchar(255) not null,
    service_name text not null,
    amount_without_vat numeric(14,2) not null check (amount_without_vat >= 0),
    amount_with_vat numeric(14,2) not null check (amount_with_vat >= amount_without_vat)
);
create index ix_invoice_line_invoice on payment_invoice_line(invoice_id);
create index ix_invoice_client_contract on payment_invoice(client_id, contract_id, code desc);
create index ix_charge_invoice_filter on billing_charge(client_id, contract_id, performed_at);
