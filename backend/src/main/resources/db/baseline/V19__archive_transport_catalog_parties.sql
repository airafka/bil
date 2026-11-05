-- Carrier catalog shares parties with order consignees. Preserve document links when hiding old catalog entries.
ALTER TABLE client_related_entity ADD COLUMN transport_catalog_archived boolean NOT NULL DEFAULT false;
