-- Normalize waybill seal types to the same reference used by transport orders.
ALTER TABLE waybill_zpu RENAME COLUMN zpu_type TO legacy_zpu_type;
ALTER TABLE waybill_zpu ADD COLUMN zpu_type uuid REFERENCES seal_type(id) ON DELETE RESTRICT;
CREATE INDEX waybill_zpu_zpu_type_idx ON waybill_zpu(zpu_type);

INSERT INTO seal_type(id, code) VALUES
 ('b2100000-0000-0000-0000-000000000001', 'закрутка'),
 ('b2100000-0000-0000-0000-000000000002', 'Иностранное ЗПУ')
ON CONFLICT (code) DO NOTHING;

-- Preserve every existing non-empty type, reusing existing reference IDs.
INSERT INTO seal_type(id, code)
SELECT gen_random_uuid(), legacy.code
FROM (SELECT DISTINCT legacy_zpu_type AS code FROM waybill_zpu WHERE nullif(btrim(legacy_zpu_type), '') IS NOT NULL) legacy
ON CONFLICT (code) DO NOTHING;
UPDATE waybill_zpu z SET zpu_type = st.id FROM seal_type st WHERE st.code = z.legacy_zpu_type;

CREATE OR REPLACE VIEW waybill_container_details AS
SELECT wc.id,wc.waybill_railway_carriage_id,wc.container_id,wc.weight,wc.net_weight,wc.owner,
 wc.owner_container_id,cl.name::varchar(255) AS owner_container_name,
 z.seal_numbers,z.seal_type_id,z.seal_type_name
FROM waybill_container wc LEFT JOIN client cl ON cl.id=wc.owner_container_id
LEFT JOIN LATERAL (
 SELECT string_agg(wz.zpu, ', ' ORDER BY wz.zpu) AS seal_numbers,
  (array_agg(wz.zpu_type ORDER BY st.code, wz.zpu_type) FILTER (WHERE wz.zpu_type IS NOT NULL))[1] AS seal_type_id,
  min(st.code)::text AS seal_type_name
 FROM waybill_zpu wz LEFT JOIN seal_type st ON st.id=wz.zpu_type
 WHERE wz.waybill_container_id=wc.id
) z ON true;
-- The single-type summary retains the previous alphabetical-first behavior.
-- All individual ZPU rows retain their own FK. No duplicated type text remains.
ALTER TABLE waybill_zpu DROP COLUMN legacy_zpu_type;
