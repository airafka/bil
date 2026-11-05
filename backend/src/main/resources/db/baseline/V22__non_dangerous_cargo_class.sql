-- Distinguish an explicitly non-dangerous product from missing classification.
INSERT INTO danger_class(id, code, code_danger_class, group_name)
SELECT 'b2200000-0000-0000-0000-000000000001'::uuid, 'Неопасный груз', '0', 'Неопасный груз'
WHERE NOT EXISTS (SELECT 1 FROM danger_class WHERE code = 'Неопасный груз');

UPDATE danger_product SET name = 'Неопасный груз', danger_class_id = (SELECT id FROM danger_class WHERE code = 'Неопасный груз')
WHERE identifier = -1;
-- waybill_product_details already follows product -> danger_product -> danger_class.
-- Classify all existing waybills as explicitly requested; keep all other fields.
UPDATE waybill_product SET danger_product_id = (SELECT id FROM danger_product WHERE identifier = -1)
WHERE danger_product_id IS DISTINCT FROM (SELECT id FROM danger_product WHERE identifier = -1);
