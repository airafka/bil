alter table shipping_order
    drop constraint ck_shipping_order_filling_type;

alter table shipping_order
    add constraint ck_shipping_order_filling_type
        check (filling_type in (
            'ALL',
            'RAILWAY_CARRIAGE',
            'CONTAINER',
            'NONE',
            'VEHICLE_UNNUMBERED'
        ));
