-- Unknown historical creation dates are deliberately left null.
ALTER TABLE receiving_order ADD COLUMN transport_waybill_number varchar(255);
ALTER TABLE shipping_order ADD COLUMN transport_waybill_number varchar(255);
ALTER TABLE receiving_order ADD COLUMN created_at timestamptz;
ALTER TABLE shipping_order ADD COLUMN created_at timestamptz;
ALTER TABLE receiving_order ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE shipping_order ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
