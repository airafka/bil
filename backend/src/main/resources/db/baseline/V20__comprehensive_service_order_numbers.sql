-- Separate comprehensive service numbering from ownership requests.
-- One-time renumbering explicitly requested for existing records; UUID relations stay unchanged.
LOCK TABLE comprehensive_service_order, payment_invoice_line IN ACCESS EXCLUSIVE MODE;
CREATE SEQUENCE comprehensive_service_order_number_seq AS integer START WITH 2841
    OWNED BY comprehensive_service_order.code;
CREATE TEMP TABLE renumber_comprehensive_services ON COMMIT DROP AS
SELECT id, (2840 + row_number() OVER (ORDER BY code, id))::integer AS new_code
FROM comprehensive_service_order;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM comprehensive_service_order WHERE code <= 0) THEN
        RAISE EXCEPTION 'Service renumbering requires positive existing codes';
    END IF;
END $$;
-- Temporary values avoid unique-key conflicts if an old code is already in the target range.
UPDATE comprehensive_service_order o SET code = -m.new_code
FROM renumber_comprehensive_services m WHERE m.id = o.id;
UPDATE comprehensive_service_order SET code = -code;
-- Invoice lines retain a display-code copy; renumber it as well, without touching amounts or composition.
UPDATE payment_invoice_line l SET comprehensive_service_order_code = o.code
FROM comprehensive_service_order o WHERE o.id = l.comprehensive_service_order_id
    AND l.comprehensive_service_order_code IS DISTINCT FROM o.code;
ALTER TABLE comprehensive_service_order ALTER COLUMN code
    SET DEFAULT nextval('comprehensive_service_order_number_seq');
DO $$ DECLARE next_number bigint; BEGIN
    SELECT 2841 + count(*) INTO next_number FROM renumber_comprehensive_services;
    EXECUTE format('ALTER SEQUENCE comprehensive_service_order_number_seq RESTART WITH %s', next_number);
END $$;
