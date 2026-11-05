ALTER TABLE complex_service_tariff ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE complex_service_tariff DROP CONSTRAINT complex_service_tariff_complex_service_id_contract_id_key;
CREATE UNIQUE INDEX ux_complex_service_tariff_active
    ON complex_service_tariff (complex_service_id, client_id, contract_id) WHERE active;
