-- Existing documents retain their historical billing rules.
ALTER TABLE complex_service_catalog ADD COLUMN order_workflow varchar(40);
UPDATE complex_service_catalog SET order_workflow='RAILWAY_RETURN'
WHERE id='fd5f3328-4684-41ee-b098-d7c370c5b175';
CREATE UNIQUE INDEX ux_catalog_order_workflow ON complex_service_catalog(order_workflow) WHERE order_workflow IS NOT NULL;
ALTER TABLE comprehensive_service_order ADD COLUMN selected_complex_service_id uuid REFERENCES complex_service_catalog(id);
ALTER TABLE comprehensive_service_order_tariff DROP CONSTRAINT comprehensive_service_order_tariff_purpose_check;
ALTER TABLE comprehensive_service_order_tariff ADD CONSTRAINT comprehensive_service_order_tariff_purpose_check CHECK (purpose IN ('A_TRAIN','A_WAGON','B_AUTO_RETURN','SELECTED'));
