alter table shipping_order
    drop constraint if exists uq_shipping_order_service_stage;
