alter table container add column load_capacity numeric(15,3);
alter table container add constraint ck_container_load_capacity check (load_capacity > 0);
alter table waybill_product add column hazard_class_id uuid references hazard_class(id);
