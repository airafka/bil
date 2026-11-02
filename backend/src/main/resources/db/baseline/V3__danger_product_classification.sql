-- Keep existing class IDs and labels; align the reference with the current system.
ALTER TABLE danger_class RENAME COLUMN name TO code;
ALTER TABLE danger_class ADD COLUMN code_danger_class varchar(9);
ALTER TABLE danger_class ADD COLUMN group_name varchar(50);

INSERT INTO danger_class(id, code, code_danger_class, group_name)
SELECT gen_random_uuid(), 'Отсутствует', '0', 'Отсутствует'
WHERE NOT EXISTS (SELECT 1 FROM danger_class WHERE code = 'Отсутствует');
UPDATE danger_class SET code_danger_class = '0', group_name = 'Отсутствует'
WHERE code = 'Отсутствует';

CREATE TABLE danger_product (
    id uuid PRIMARY KEY,
    identifier integer NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    danger_class_id uuid NOT NULL REFERENCES danger_class(id)
);
INSERT INTO danger_product(id, identifier, name, danger_class_id)
SELECT gen_random_uuid(), -1, 'неопасный груз', id FROM danger_class WHERE code = 'Отсутствует';

-- Historical text is not a reliable classifier. Leave existing rows unclassified.
ALTER TABLE waybill_product ADD COLUMN danger_product_id uuid REFERENCES danger_product(id);
CREATE INDEX idx_waybill_product_danger_product ON waybill_product(danger_product_id);
CREATE INDEX idx_danger_product_danger_class ON danger_product(danger_class_id);
CREATE OR REPLACE VIEW waybill_product_details AS
SELECT p.id, p.waybill_id, p.etsng_code_id, p.sign_danger, p.weight,
       h.id AS danger_class_id, h.code AS danger_class_name,
       p.danger_product_id, d.identifier AS danger_product_identifier,
       d.name AS danger_product_name, h.code_danger_class
FROM waybill_product p
LEFT JOIN danger_product d ON d.id = p.danger_product_id
LEFT JOIN danger_class h ON h.id = d.danger_class_id;
