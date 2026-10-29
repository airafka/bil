alter table receiving_order
    add column driver_full_name varchar(255),
    add column vehicle_number varchar(32);

alter table shipping_order
    add column driver_full_name varchar(255),
    add column vehicle_number varchar(32);
