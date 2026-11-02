ALTER TABLE receiving_order ADD COLUMN default_container_owner_id uuid REFERENCES client(id);
UPDATE receiving_order SET default_container_owner_id=client_id;
-- Existing explicit owners and all confirmed stock/history remain unchanged.
UPDATE receiving_order_container oc SET owner_container_id=r.default_container_owner_id
FROM receiving_order r WHERE r.id=oc.receiving_order_id
    AND r.order_status='DRAFT' AND oc.owner_container_id IS NULL;
