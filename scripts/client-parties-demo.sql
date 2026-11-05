-- One-time, explicitly requested sample companies and cargo-party correction.
-- Does not change order client/contract, owner, dates, route, status or billing.
BEGIN;
INSERT INTO client(id,name) VALUES
 ('20000000-0000-4000-8000-000000000001','ПАО "СИБУР Холдинг"'),
 ('20000000-0000-4000-8000-000000000002','ООО "Смартлог"'),
 ('20000000-0000-4000-8000-000000000003','ПАО "ТрансКонтейнер"')
ON CONFLICT DO NOTHING;

UPDATE receiving_order o SET consignor=c.name
FROM (VALUES
 (28548,'ПАО "СИБУР Холдинг"'), (28549,'ООО "Смартлог"'),
 (28551,'ПАО "ТрансКонтейнер"'), (28552,'ПАО "СИБУР Холдинг"'),
 (28553,'ООО "Смартлог"'), (28555,'ПАО "ТрансКонтейнер"'),
 (28559,'ПАО "СИБУР Холдинг"'), (28560,'ООО "Смартлог"'),
 (28562,'ПАО "ТрансКонтейнер"')) AS m(number,name)
JOIN client c ON c.name=m.name
WHERE o.number=m.number AND NOT EXISTS (SELECT 1 FROM client existing WHERE existing.name=o.consignor);

INSERT INTO client_related_entity(id,name,active,transport_catalog_archived)
SELECT id,name,false,true FROM client WHERE id IN
 ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003')
ON CONFLICT(name) DO NOTHING;

UPDATE shipping_order o SET consignee_id=p.id
FROM (VALUES
 (28550,'ООО "Смартлог"'), (28554,'ПАО "ТрансКонтейнер"'),
 (28556,'ПАО "СИБУР Холдинг"'), (28557,'ООО "Смартлог"'),
 (28558,'ПАО "ТрансКонтейнер"'), (28561,'ПАО "СИБУР Холдинг"')) AS m(number,name)
JOIN client c ON c.name=m.name JOIN client_related_entity p ON p.name=c.name
WHERE o.number=m.number AND NOT EXISTS
 (SELECT 1 FROM client_related_entity old JOIN client existing ON existing.name=old.name WHERE old.id=o.consignee_id);
COMMIT;
