-- The user removed ALL unknown/quantity-based order variants from MVP.
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM shipping_order WHERE filling_type<>'ALL')
       OR EXISTS(SELECT 1 FROM shipping_order_container_qty)
       OR EXISTS(SELECT 1 FROM shipping_order_railway_carriage_qty)
       OR EXISTS(SELECT 1 FROM shipping_order_etsng_code) THEN
        RAISE EXCEPTION 'Quantity-based orders exist: explicit data conversion is required';
    END IF;
END $$;
ALTER TABLE shipping_order DROP CONSTRAINT ck_shipping_order_filling_type;
ALTER TABLE shipping_order ADD CONSTRAINT ck_shipping_order_filling_type CHECK(filling_type='ALL');
DROP TABLE shipping_order_etsng_code;
DROP TABLE shipping_order_container_qty;
DROP TABLE shipping_order_railway_carriage_qty;
