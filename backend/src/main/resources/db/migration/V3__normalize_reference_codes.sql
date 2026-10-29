drop index uq_container_code_ci;
drop index uq_railway_carriage_code_ci;
drop index uq_client_code_ci;
drop index uq_etsng_code_code_ci;

create unique index uq_container_code_ci on container(lower(btrim(code)));
create unique index uq_railway_carriage_code_ci on railway_carriage(lower(btrim(code)));
create unique index uq_client_code_ci on client(lower(btrim(code)));
create unique index uq_etsng_code_code_ci on etsng_code(lower(btrim(code)));

alter table container
    add constraint ck_container_code_trimmed check (code = btrim(code));
alter table railway_carriage
    add constraint ck_railway_carriage_code_trimmed check (code = btrim(code));
alter table client
    add constraint ck_client_code_trimmed check (code = btrim(code));
alter table etsng_code
    add constraint ck_etsng_code_code_trimmed check (code = btrim(code));

