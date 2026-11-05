\set ON_ERROR_STOP on
-- One-off, explicitly requested demo data. See reference-fill-20261103.md.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE container, railway_carriage, railway_carriage_model IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE before_containers AS SELECT * FROM container;
CREATE TEMP TABLE before_carriages AS SELECT * FROM railway_carriage;
CREATE TEMP TABLE before_other (name text PRIMARY KEY, digest text);
DO $$ DECLARE r record; h text; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND tablename NOT IN ('container','railway_carriage','railway_carriage_model') LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(x,chr(10) ORDER BY x),'''')) FROM (SELECT row_to_json(t)::text x FROM public.%I t) q',r.tablename) INTO h;
    INSERT INTO before_other VALUES (r.tablename,h);
  END LOOP;
  IF (SELECT count(*) FROM container) <> 25 OR (SELECT count(*) FROM railway_carriage) <> 17
    OR EXISTS(SELECT 1 FROM container WHERE lifting_capacity IS NOT NULL)
    OR EXISTS(SELECT 1 FROM railway_carriage WHERE model_id IS NOT NULL OR lifting_capacity IS NOT NULL OR date_depot_repair IS NOT NULL)
    OR EXISTS(SELECT 1 FROM railway_carriage_model) THEN
    RAISE EXCEPTION 'Source state changed; review before running (not a reusable seed)';
  END IF;
END $$;
CREATE TEMP TABLE before_sequences AS SELECT schemaname,sequencename,last_value FROM pg_sequences WHERE schemaname='public';
INSERT INTO railway_carriage_model(id,code) VALUES
 ('b2032000-0000-0000-0000-000000000040','13-6851-01'),
 ('b2032000-0000-0000-0000-000000000060','13-1223'),
 ('b2032000-0000-0000-0000-000000000080','13-6903');
-- Published example maximum gross minus EXISTING tare; not actual numbered-unit passport data.
UPDATE container SET lifting_capacity = CASE container_type
  WHEN 'STANDARD_20' THEN 30480 - weight WHEN 'STANDARD_40' THEN 32500 - weight END
WHERE lifting_capacity IS NULL AND container_type IN ('STANDARD_20','STANDARD_40');
-- Preserve all existing platform lengths. Unassigned units receive an explicit demo length.
UPDATE railway_carriage c SET type_id=t.id FROM railway_carriage_type t
WHERE c.type_id IS NULL AND t.code=CASE WHEN c.code IN ('91271197','91635193','VGN-0001')
  THEN 'PLATFORM_40' ELSE 'PLATFORM_80' END;
UPDATE railway_carriage c SET model_id=m.id,
 lifting_capacity=CASE t.code WHEN 'PLATFORM_40' THEN 80000 WHEN 'PLATFORM_60' THEN 72000 WHEN 'PLATFORM_80' THEN 74500 END
FROM railway_carriage_type t, railway_carriage_model m
WHERE t.id=c.type_id AND m.code=CASE t.code WHEN 'PLATFORM_40' THEN '13-6851-01' WHEN 'PLATFORM_60' THEN '13-1223' WHEN 'PLATFORM_80' THEN '13-6903' END;
WITH dates AS (SELECT id,row_number() OVER (ORDER BY code,id)::integer AS n FROM railway_carriage)
UPDATE railway_carriage c SET date_depot_repair=DATE '2032-01-15'+(d.n-1)*21
FROM dates d WHERE d.id=c.id AND c.date_depot_repair IS NULL;
DO $$ DECLARE r record; h text; BEGIN
  IF EXISTS(SELECT 1 FROM container WHERE lifting_capacity IS NULL OR lifting_capacity<=0)
    OR EXISTS(SELECT 1 FROM railway_carriage WHERE model_id IS NULL OR type_id IS NULL OR lifting_capacity<=0 OR lifting_capacity IS NULL
      OR date_depot_repair IS NULL OR extract(year FROM date_depot_repair)<>2032) THEN
    RAISE EXCEPTION 'Missing/invalid reference values'; END IF;
  IF EXISTS(SELECT 1 FROM before_containers b FULL JOIN container c USING(id)
    WHERE (to_jsonb(b)-'lifting_capacity') IS DISTINCT FROM (to_jsonb(c)-'lifting_capacity')) THEN
    RAISE EXCEPTION 'Unexpected container change'; END IF;
  IF EXISTS(SELECT 1 FROM before_carriages b FULL JOIN railway_carriage c USING(id)
    WHERE b.id IS NULL OR c.id IS NULL OR b.code IS DISTINCT FROM c.code OR (b.type_id IS NOT NULL AND b.type_id IS DISTINCT FROM c.type_id)) THEN
    RAISE EXCEPTION 'Unexpected carriage identity/type change'; END IF;
  FOR r IN SELECT * FROM before_other LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(x,chr(10) ORDER BY x),'''')) FROM (SELECT row_to_json(t)::text x FROM public.%I t) q',r.name) INTO h;
    IF h IS DISTINCT FROM r.digest THEN RAISE EXCEPTION 'Unexpected change in %',r.name; END IF;
  END LOOP;
  IF EXISTS((SELECT * FROM before_sequences EXCEPT SELECT schemaname,sequencename,last_value FROM pg_sequences WHERE schemaname='public')
    UNION ALL (SELECT schemaname,sequencename,last_value FROM pg_sequences WHERE schemaname='public' EXCEPT SELECT * FROM before_sequences)) THEN
    RAISE EXCEPTION 'Sequence changed'; END IF;
END $$;
SELECT container_type,count(*),min(lifting_capacity),max(lifting_capacity) FROM container GROUP BY container_type;
SELECT t.code,m.code,count(*),min(c.lifting_capacity),min(c.date_depot_repair),max(c.date_depot_repair)
FROM railway_carriage c JOIN railway_carriage_type t ON t.id=c.type_id JOIN railway_carriage_model m ON m.id=c.model_id GROUP BY t.code,m.code ORDER BY t.code;
COMMIT;
