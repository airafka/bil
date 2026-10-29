-- Preserve delivery/removal orders and waybills; remove only obsolete service metadata.
alter table receiving_order
    drop column service_order_id,
    drop column complex_service_stage_id,
    drop column source_shipping_order_id;

alter table shipping_order
    drop column service_order_id,
    drop column complex_service_stage_id;

drop table service_order;
drop table complex_service_stage;
drop table complex_service;
drop table individual_service;
