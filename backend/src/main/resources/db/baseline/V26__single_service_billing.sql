-- Remove the obsolete A/B workflow only when all orders already use the selected-service model.
-- Fail rather than reinterpret or erase historical charges.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM comprehensive_service_order s
        WHERE s.selected_complex_service_id IS NULL OR s.tariffs_fixed_at IS NULL
          OR NOT EXISTS (SELECT 1 FROM comprehensive_service_order_tariff t
              WHERE t.comprehensive_service_order_id=s.id AND t.complex_service_id=s.selected_complex_service_id))
       OR EXISTS (SELECT 1 FROM comprehensive_service_order_tariff WHERE purpose <> 'SELECTED')
       OR EXISTS (SELECT 1 FROM service_execution e JOIN comprehensive_service_order s ON s.id=e.comprehensive_service_order_id
           JOIN receiving_order r ON r.id=e.receiving_order_id
           WHERE e.family <> 'A' OR e.complex_service_id <> s.selected_complex_service_id
             OR r.service_role <> 'RETURN_RECEIVING' OR e.status <> 'PERFORMED') THEN
        RAISE EXCEPTION 'Legacy service orders require explicit reconciliation before V26';
    END IF;
END $$;

-- FK restrictions prevent removal if an unexpected document still references the obsolete service/tariff.
DELETE FROM complex_service_catalog WHERE purpose='B_AUTO_RETURN';
ALTER TABLE complex_service_catalog DROP COLUMN purpose;
ALTER TABLE receiving_order DROP COLUMN a_complex_service_id;
ALTER TABLE service_execution DROP COLUMN family, DROP COLUMN accepted_container_count;
ALTER TABLE service_execution ADD CONSTRAINT service_execution_parent_container_key
    UNIQUE(comprehensive_service_order_id,container_id);
ALTER TABLE comprehensive_service_order_tariff DROP COLUMN purpose;
ALTER TABLE comprehensive_service_order_tariff ADD CONSTRAINT service_tariff_one_per_order
    UNIQUE(comprehensive_service_order_id);
ALTER TABLE comprehensive_service_order ALTER COLUMN selected_complex_service_id SET NOT NULL;
