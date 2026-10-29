alter table container
    add column type varchar(32),
    add constraint ck_container_type
        check (type is null or type in ('STANDARD_20', 'STANDARD_40'));

create index ix_container_type on container(type);

alter table railway_carriage
    add column type_id uuid,
    add constraint fk_railway_carriage_type
        foreign key (type_id) references railway_carriage_type(id) on delete restrict;

create index ix_railway_carriage_type_id on railway_carriage(type_id);
