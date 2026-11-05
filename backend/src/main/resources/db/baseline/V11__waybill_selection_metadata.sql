-- Historical creation times were not stored: do not invent ETRAN dates.
ALTER TABLE waybill ADD COLUMN created_at timestamptz;
ALTER TABLE waybill ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE waybill ADD COLUMN shipment_type varchar(50) NOT NULL DEFAULT 'CONTAINER';
ALTER TABLE waybill ADD COLUMN status varchar(50) NOT NULL DEFAULT 'IN_TRANSIT';
