create table complex_service (
    id uuid primary key,
    code integer generated always as identity,
    name varchar(255) not null,
    constraint uq_complex_service_code unique (code),
    constraint ck_complex_service_name_not_blank check (btrim(name) <> ''),
    constraint ck_complex_service_name_trimmed check (name = btrim(name))
);

create table complex_service_stage (
    id uuid primary key,
    complex_service_id uuid not null references complex_service(id) on delete cascade,
    position integer not null,
    order_type varchar(30) not null,
    transport_type varchar(30) not null,
    container_state varchar(30) not null,
    constraint uq_complex_service_stage_position unique (complex_service_id, position),
    constraint ck_complex_service_stage_position_positive check (position > 0),
    constraint ck_complex_service_stage_order_type check (order_type in ('RECEIVING', 'SHIPPING')),
    constraint ck_complex_service_stage_transport_type check (transport_type in ('RAILWAY', 'VEHICLE')),
    constraint ck_complex_service_stage_container_state check (container_state in ('EMPTY', 'LOADED', 'ANY'))
);

create index ix_complex_service_code_desc on complex_service(code desc);
create index ix_complex_service_stage_service_position
    on complex_service_stage(complex_service_id, position);
