alter table receiving_order drop constraint ck_receiving_order_status;
alter table receiving_order add constraint ck_receiving_order_status check (status in ('DRAFT', 'CONFIRMED', 'COMPLETED'));
alter table shipping_order drop constraint ck_shipping_order_status;
alter table shipping_order add constraint ck_shipping_order_status check (status in ('DRAFT', 'CONFIRMED', 'COMPLETED'));
alter table service_order drop constraint service_order_status_check;
alter table service_order add constraint service_order_status_check check (status in ('DRAFT', 'CONFIRMED', 'COMPLETED'));
