-- Receiving and shipping share their own sequence, independent of other order types.
CREATE SEQUENCE transport_order_number_seq AS integer START WITH 28548;
SELECT setval('transport_order_number_seq', greatest(28548,
    coalesce((SELECT max(number) FROM receiving_order), 0) + 1,
    coalesce((SELECT max(number) FROM shipping_order), 0) + 1), false);
ALTER TABLE receiving_order ALTER COLUMN number SET DEFAULT nextval('transport_order_number_seq');
ALTER TABLE shipping_order ALTER COLUMN number SET DEFAULT nextval('transport_order_number_seq');

-- Preserve existing route numbers and never rewind an already advanced sequence.
DO $$
DECLARE next_number bigint;
BEGIN
    SELECT greatest(21326, coalesce((SELECT max(number) FROM route), 0) + 1,
        last_value + CASE WHEN is_called THEN 1 ELSE 0 END)
    INTO next_number FROM route_code_seq;
    EXECUTE format('ALTER SEQUENCE route_code_seq RESTART WITH %s', next_number);
END $$;