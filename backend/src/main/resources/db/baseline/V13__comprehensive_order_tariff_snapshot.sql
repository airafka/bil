-- Existing orders keep NULL: their creation-time tariff cannot be reconstructed.
ALTER TABLE comprehensive_service_order ADD COLUMN tariffs_fixed_at timestamp with time zone;
CREATE TABLE comprehensive_service_order_tariff (
    comprehensive_service_order_id uuid NOT NULL REFERENCES comprehensive_service_order(id) ON DELETE CASCADE,
    complex_service_id uuid NOT NULL REFERENCES complex_service_catalog(id) ON DELETE RESTRICT,
    tariff_id uuid NOT NULL REFERENCES complex_service_tariff(id) ON DELETE RESTRICT,
    purpose varchar(30) NOT NULL CHECK (purpose IN ('A_TRAIN', 'A_WAGON', 'B_AUTO_RETURN')),
    coefficient numeric(12,4) NOT NULL CHECK (coefficient > 0),
    base_price_without_vat numeric(14,2) NOT NULL CHECK (base_price_without_vat >= 0),
    base_price_with_vat numeric(14,2) NOT NULL CHECK (base_price_with_vat >= base_price_without_vat),
    price_without_vat numeric(24,2) NOT NULL CHECK (price_without_vat >= 0),
    price_with_vat numeric(24,2) NOT NULL CHECK (price_with_vat >= price_without_vat),
    PRIMARY KEY (comprehensive_service_order_id, complex_service_id),
    UNIQUE (comprehensive_service_order_id, purpose)
);
CREATE INDEX ix_comprehensive_order_tariff_source ON comprehensive_service_order_tariff(tariff_id);
