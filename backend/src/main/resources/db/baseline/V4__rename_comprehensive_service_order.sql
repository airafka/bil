-- The MVP orchestrator is a comprehensive service order. Reserve service_order
-- for the production ownership-change process. All IDs and data remain intact.
ALTER TABLE service_order RENAME TO comprehensive_service_order;
ALTER TABLE receiving_order RENAME COLUMN service_order_id TO comprehensive_service_order_id;
ALTER TABLE shipping_order RENAME COLUMN service_order_id TO comprehensive_service_order_id;
ALTER TABLE shipping_order_source_container RENAME COLUMN service_order_id TO comprehensive_service_order_id;
ALTER TABLE service_execution RENAME COLUMN service_order_id TO comprehensive_service_order_id;
ALTER TABLE payment_invoice_line RENAME COLUMN service_order_id TO comprehensive_service_order_id;
ALTER TABLE payment_invoice_line RENAME COLUMN service_order_code TO comprehensive_service_order_code;

-- Rename legacy constraint/index identifiers too, including the indexes backing
-- primary/unique constraints, so the future service_order can use its own names.
-- PostgreSQL identifiers are limited to 63 bytes; retain a hash for long names.
DO $$
DECLARE item record; new_name text;
BEGIN
    FOR item IN
        SELECT c.conname, n.nspname, t.relname
        FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND c.conname LIKE '%service_order%'
    LOOP
        new_name := replace(item.conname, 'service_order', 'comprehensive_service_order');
        IF length(new_name) > 63 THEN
            new_name := left(new_name, 54) || '_' || left(md5(new_name), 8);
        END IF;
        EXECUTE format('ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
            item.nspname, item.relname, item.conname, new_name);
    END LOOP;
    FOR item IN
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname LIKE '%service_order%'
            AND indexname NOT LIKE '%comprehensive_service_order%'
    LOOP
        new_name := replace(item.indexname, 'service_order', 'comprehensive_service_order');
        IF length(new_name) > 63 THEN
            new_name := left(new_name, 54) || '_' || left(md5(new_name), 8);
        END IF;
        EXECUTE format('ALTER INDEX public.%I RENAME TO %I', item.indexname, new_name);
    END LOOP;
END $$;
