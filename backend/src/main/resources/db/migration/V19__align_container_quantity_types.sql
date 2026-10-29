update shipping_order_container_qty
set type = 'STANDARD_20'
where type in ('REFRIGERATOR_20', 'TANK_20');

update shipping_order_container_qty
set type = 'STANDARD_40'
where type in ('REFRIGERATOR_40', 'TANK_40');

alter table shipping_order_container_qty
    drop constraint ck_shipping_order_container_qty_type,
    add constraint ck_shipping_order_container_qty_type
        check (type in ('STANDARD_20', 'STANDARD_40'));
