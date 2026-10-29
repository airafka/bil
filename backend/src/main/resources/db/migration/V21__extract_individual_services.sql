create table individual_service (
    id uuid primary key,
    code integer generated always as identity,
    name varchar(255) not null,
    order_type varchar(30) not null,
    transport_type varchar(30) not null,
    container_state varchar(30) not null,
    created_at timestamptz not null default now(),
    constraint uq_individual_service_code unique (code),
    constraint ck_individual_service_name_not_blank check (btrim(name) <> ''),
    constraint ck_individual_service_name_trimmed check (name = btrim(name)),
    constraint ck_individual_service_order_type check (order_type in ('RECEIVING', 'SHIPPING')),
    constraint ck_individual_service_transport_type check (transport_type in ('RAILWAY', 'VEHICLE')),
    constraint ck_individual_service_container_state check (container_state in ('EMPTY', 'LOADED', 'ANY'))
);

create index ix_individual_service_code_desc on individual_service(code desc);

insert into individual_service (id, name, order_type, transport_type, container_state)
select gen_random_uuid(),
       case stage.order_type
           when 'RECEIVING' then 'Поставка'
           else 'Вывоз'
       end || ' / ' ||
       case stage.transport_type
           when 'RAILWAY' then 'ЖД'
           else 'Авто'
       end || ' / ' ||
       case stage.container_state
           when 'EMPTY' then 'Порожний КТК'
           when 'LOADED' then 'Гружёный КТК'
           else 'Любое состояние КТК'
       end,
       stage.order_type,
       stage.transport_type,
       stage.container_state
  from (
        select distinct order_type, transport_type, container_state
          from complex_service_stage
       ) stage;

alter table complex_service_stage
    add column service_id uuid;

update complex_service_stage stage
   set service_id = service.id
  from individual_service service
 where service.order_type = stage.order_type
   and service.transport_type = stage.transport_type
   and service.container_state = stage.container_state;

alter table complex_service_stage
    alter column service_id set not null,
    add constraint fk_complex_service_stage_service
        foreign key (service_id) references individual_service(id) on delete restrict;

create index ix_complex_service_stage_service_id on complex_service_stage(service_id);

alter table complex_service_stage
    drop constraint ck_complex_service_stage_order_type,
    drop constraint ck_complex_service_stage_transport_type,
    drop constraint ck_complex_service_stage_container_state,
    drop column order_type,
    drop column transport_type,
    drop column container_state;
