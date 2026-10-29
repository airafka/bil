create table service_order (
    id uuid primary key,
    code integer generated always as identity,
    client_id uuid not null references client(id) on delete restrict,
    service varchar(100) not null,
    complex_service_id uuid references complex_service(id) on delete restrict,
    comment text,
    status varchar(100) not null,
    created_at timestamp with time zone not null default current_timestamp,
    constraint uq_service_order_code unique (code),
    constraint ck_service_order_service check (service in ('COMPLEX_SERVICE')),
    constraint ck_service_order_status check (status in ('DRAFT')),
    constraint ck_service_order_complex_service check (
        (service = 'COMPLEX_SERVICE' and complex_service_id is not null)
        or (service <> 'COMPLEX_SERVICE' and complex_service_id is null)
    ),
    constraint ck_service_order_comment_trimmed check (comment is null or comment = btrim(comment)),
    constraint ck_service_order_comment_not_blank check (comment is null or comment <> '')
);

create index ix_service_order_client_id on service_order(client_id);
create index ix_service_order_complex_service_id on service_order(complex_service_id);
create index ix_service_order_code_desc on service_order(code desc);

alter table receiving_order
    add column service_order_id uuid references service_order(id) on delete restrict,
    add column complex_service_stage_id uuid references complex_service_stage(id) on delete restrict,
    add constraint ck_receiving_order_service_context check (
        (service_order_id is null and complex_service_stage_id is null)
        or (service_order_id is not null and complex_service_stage_id is not null)
    ),
    add constraint uq_receiving_order_service_stage unique (service_order_id, complex_service_stage_id);

create index ix_receiving_order_service_order_id on receiving_order(service_order_id);
create index ix_receiving_order_complex_service_stage_id on receiving_order(complex_service_stage_id);

alter table shipping_order
    add column service_order_id uuid references service_order(id) on delete restrict,
    add column complex_service_stage_id uuid references complex_service_stage(id) on delete restrict,
    add constraint ck_shipping_order_service_context check (
        (service_order_id is null and complex_service_stage_id is null)
        or (service_order_id is not null and complex_service_stage_id is not null)
    ),
    add constraint uq_shipping_order_service_stage unique (service_order_id, complex_service_stage_id);

create index ix_shipping_order_service_order_id on shipping_order(service_order_id);
create index ix_shipping_order_complex_service_stage_id on shipping_order(complex_service_stage_id);
