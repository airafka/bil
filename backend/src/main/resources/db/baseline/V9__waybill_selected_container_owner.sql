ALTER TABLE waybill_container ADD COLUMN owner_container_id uuid REFERENCES client(id) ON DELETE RESTRICT;
CREATE INDEX idx_waybill_container_owner ON waybill_container(owner_container_id);
-- Preserve explicitly selected owners of existing railway receipts; source owner text is never matched.
UPDATE waybill_container wc SET owner_container_id=coalesce(
 (SELECT oc.owner_container_id FROM receiving_order_container oc WHERE oc.receiving_order_id=r.id AND oc.container_id=wc.container_id),r.default_container_owner_id)
FROM waybill_railway_carriage rc JOIN waybill w ON w.id=rc.waybill_id JOIN receiving_order r ON r.id=w.receiving_order_id
WHERE wc.waybill_railway_carriage_id=rc.id AND r.transport_type='RAILWAY';
CREATE OR REPLACE VIEW waybill_container_details AS
SELECT wc.id,wc.waybill_railway_carriage_id,wc.container_id,wc.weight,wc.net_weight,wc.owner,
 wc.owner_container_id,cl.name::varchar(255) AS owner_container_name,
 z.seal_numbers,st.id AS seal_type_id,z.zpu_type AS seal_type_name
FROM waybill_container wc LEFT JOIN client cl ON cl.id=wc.owner_container_id
LEFT JOIN LATERAL (SELECT string_agg(zpu, ', ' ORDER BY zpu) AS seal_numbers,min(zpu_type) AS zpu_type FROM waybill_zpu WHERE waybill_container_id=wc.id) z ON true
LEFT JOIN seal_type st ON st.code=z.zpu_type;
