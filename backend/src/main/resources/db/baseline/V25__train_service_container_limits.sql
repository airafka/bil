-- Both catalog services share the return workflow. Limits apply per waybill to new orders only.
DROP INDEX ux_catalog_order_workflow;
ALTER TABLE complex_service_catalog
    ADD COLUMN min_waybill_containers integer,
    ADD COLUMN max_waybill_containers integer,
    ADD CONSTRAINT catalog_waybill_container_limits CHECK (
        (min_waybill_containers IS NULL OR min_waybill_containers >= 0) AND
        (max_waybill_containers IS NULL OR max_waybill_containers >= 0) AND
        (min_waybill_containers IS NULL OR max_waybill_containers IS NULL OR min_waybill_containers <= max_waybill_containers));
UPDATE complex_service_catalog SET min_waybill_containers=1, max_waybill_containers=39
WHERE id='fd5f3328-4684-41ee-b098-d7c370c5b175';
UPDATE complex_service_catalog SET order_workflow='RAILWAY_RETURN', min_waybill_containers=40
WHERE id='626df5f3-e629-4eb0-9369-ea724120ac7c';
