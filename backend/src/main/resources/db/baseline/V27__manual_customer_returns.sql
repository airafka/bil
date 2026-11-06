-- Return transport can belong to a separate customer's service, while preserving its source shipment.
ALTER TABLE comprehensive_service_order ADD COLUMN workflow varchar(40) NOT NULL DEFAULT 'RAILWAY_RETURN',
    ADD COLUMN source_service_order_id uuid REFERENCES comprehensive_service_order(id) ON DELETE RESTRICT,
    ADD CONSTRAINT service_order_workflow CHECK (
      (workflow='RAILWAY_RETURN' AND source_service_order_id IS NULL) OR
      (workflow='AUTO_RETURN' AND source_service_order_id IS NOT NULL AND source_service_order_id<>id));

INSERT INTO complex_service_catalog(id,name,price_without_vat,price_with_vat,order_workflow)
VALUES ('612b6a16-0972-4be2-9f75-0fe8ad7254e1','Комплексная услуга по приему контейнера, прибывшего автотранспортом',5700,6954,'AUTO_RETURN')
ON CONFLICT(id) DO UPDATE SET order_workflow='AUTO_RETURN';
CREATE UNIQUE INDEX catalog_auto_return_workflow ON complex_service_catalog(order_workflow) WHERE order_workflow='AUTO_RETURN';

ALTER TABLE receiving_order DROP CONSTRAINT fk_receiving_return_source;
ALTER TABLE receiving_order ADD CONSTRAINT fk_receiving_return_source FOREIGN KEY(source_shipping_order_id) REFERENCES shipping_order(id) ON DELETE RESTRICT;
DROP INDEX uq_receiving_return_per_shipping;
CREATE INDEX receiving_return_source_idx ON receiving_order(source_shipping_order_id);
ALTER TABLE receiving_order ADD CONSTRAINT receiving_source_pair UNIQUE(id,source_shipping_order_id);
ALTER TABLE receiving_order_container ADD COLUMN source_shipping_order_id uuid;
UPDATE receiving_order_container rc SET source_shipping_order_id=r.source_shipping_order_id
FROM receiving_order r WHERE r.id=rc.receiving_order_id AND r.service_role='RETURN_RECEIVING';
ALTER TABLE receiving_order_container ADD CONSTRAINT return_container_source
    FOREIGN KEY(receiving_order_id,source_shipping_order_id) REFERENCES receiving_order(id,source_shipping_order_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX return_container_once ON receiving_order_container(source_shipping_order_id,container_id) WHERE source_shipping_order_id IS NOT NULL;

ALTER TABLE service_execution DROP CONSTRAINT service_execution_receiving_order_id_comprehensive_ser_e65c0289,
    DROP CONSTRAINT service_execution_shipping_order_id_comprehensive_serv_277fc5ae;
ALTER TABLE service_execution ADD CONSTRAINT execution_receiving_fk FOREIGN KEY(receiving_order_id) REFERENCES receiving_order(id) ON DELETE RESTRICT,
    ADD CONSTRAINT execution_shipping_fk FOREIGN KEY(shipping_order_id) REFERENCES shipping_order(id) ON DELETE RESTRICT;
