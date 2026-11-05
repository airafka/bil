-- One-off approved demo renumbering. Requires fresh backup. Rejects reruns or stale mappings.
BEGIN;
SELECT pg_advisory_xact_lock(1743125938);
LOCK TABLE container,railway_carriage,waybill_zpu,receiving_order_container,shipping_order_container IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE map_container(id uuid primary key,old_code text,new_code text) ON COMMIT DROP;
INSERT INTO map_container VALUES
('107675c8-008a-42c1-8826-062193f4e62b','AKMU4008413','TKRU9000011'),
('1c6e1c0c-b366-4d9b-b521-83b8eba16e4a','MVP40-2A2D1863A4EC','TKRU9000027'),
('20000000-0000-0000-0000-000000000001','KTK-0001','TKRU9000032'),
('20000000-0000-0000-0000-000000000002','KTK-0002','TKRU9000048'),
('20000000-0000-0000-0000-000000000003','KTK-0003','TKRU9000053'),
('20000000-0000-0000-0000-000000000004','KTK-0004','TKRU9000069'),
('20000000-0000-0000-0000-000000000005','KTK-0005','TKRU9000074'),
('20000000-0000-0000-0000-000000000006','KTK-0006','TKRU9000080'),
('20000000-0000-0000-0000-000000000007','KTK-0007','TKRU9000095'),
('20000000-0000-0000-0000-000000000008','KTK-0008','TKRU9000109'),
('20000000-0000-0000-0000-000000000009','KTK-0009','TKRU9000114'),
('20000000-0000-0000-0000-000000000010','KTK-0010','TKRU9000120'),
('2fd4358b-84b5-40df-a1bc-eb5666624a0b','MVP40-56DA75EDB2B3','TKRU9000135'),
('3f233645-aa05-4758-b565-a2843b80090b','TKRU4694223','TKRU9000140'),
('48d4376e-6bca-4917-b8c5-5fd48498f2d9','TKRU4095333','TKRU9000156'),
('63c61800-e540-48b0-8e22-0a8dcff38ad1','TKRU4661600','TKRU9000161'),
('72c871dc-c735-4a82-8774-ccd8d71550d5','TKRU4042626','TKRU9000177'),
('7cf780c8-9ca9-4d52-a993-a19681e6ab33','TKRU4696102','TKRU9000182'),
('8bf8c0bf-2d84-429f-ae80-72cbce5bbd98','TKRU4681479','TKRU9000198'),
('8d29f281-a432-470e-a6c4-6fd46cf19123','TKRU4052985','TKRU9000201'),
('8f730909-e1fb-4794-8b91-e90d8e095090','MVP40-AC7F4FE449BA','TKRU9000217'),
('a24e4287-4df5-4bef-8e6c-20516726cb07','MVP40-174930BE1A97','TKRU9000222'),
('a5982266-6fd8-4b12-a04f-d7370850aa16','MVP40-A1E401CE6A7B','TKRU9000238'),
('c5c63864-3ea8-4522-bbc0-2f9f07e4c0ad','MVP20-CFF8FF1926D7','TKRU9000243'),
('d7c85d82-4286-4d4c-bc0d-fd5f7ce6f0fe','DLRU0031010','TKRU9000259'),
('d88ea062-0ddc-452b-bb8a-2e63a418a861','TKRU4468123','TKRU9000264'),
('e9215f7d-c9dd-4d74-bf98-605212f34a5c','MVP20-B6AB029339EE','TKRU9000270'),
('edd19a65-18fc-442a-9a6b-2ee36e0f9742','TKRU4483344','TKRU9000285'),
('f6d901d6-9a87-41d5-aef2-c05a0efe59d9','DLRU0104292','TKRU9000290'),
('fac12fd3-5189-4252-8af9-6bf0821701ab','TKRU4004518','TKRU9000304'),
('fe6aff4c-f398-4b8b-8cee-8535bdc96d95','AKMU4002966','TKRU9000310'),
('febd6b1d-79b8-496f-9884-c4ea960fa37f','TKRU4520453','TKRU9000325');
DO $$ BEGIN IF (SELECT count(*) FROM container ) <> 32 OR EXISTS(SELECT 1 FROM map_container m LEFT JOIN container t ON t.id=m.id WHERE t.code IS DISTINCT FROM m.old_code) THEN RAISE EXCEPTION 'Stale mapping: container'; END IF; END $$;
UPDATE container t SET code=m.new_code FROM map_container m WHERE t.id=m.id;
CREATE TEMP TABLE map_railway_carriage(id uuid primary key,old_code text,new_code text) ON COMMIT DROP;
INSERT INTO map_railway_carriage VALUES
('40000000-0000-0000-0000-000000000001','VGN-0001','42000018'),
('40000000-0000-0000-0000-000000000002','VGN-0002','42000026'),
('4948c06c-e321-48f4-861e-6e53f565d178','91713453','42000034'),
('78b78e97-a9dc-4af5-956d-2ed4452b521b','91745075','42000042'),
('8bd98180-6e5d-4cc2-8892-2aee9daae31e','91271197','42000059'),
('8cccfc92-094a-498b-9b3b-c8329caea9cd','98502677','42000067'),
('9c53f71a-c7e5-4c48-9214-9e2d70f20e08','98172661','42000075'),
('9cc60eac-3d15-4d3c-a0b6-a7d1edccec68','98184310','42000083'),
('a2876a8f-f4d5-49cc-a4be-eb38685348d4','91635193','42000091'),
('b0e9cd21-9530-4037-9372-e0d48c7bf895','98184906','42000109'),
('b42fe3c3-c5dd-4b04-be79-149424ce98be','98503907','42000117'),
('bd79d8f9-8656-4a6d-b54e-f3a9c23abe8b','98502990','42000125'),
('c30e0a18-3a60-4047-a415-e99063d46ecc','91775155','42000133'),
('c7473f19-45a1-42fe-b1e2-91d76bc7f489','91677492','42000141'),
('d04c391c-551b-4ae0-a00f-8903e8a612e7','91719666','42000158'),
('d22826b0-b26e-4582-b0f4-94513f58cc9c','91775106','42000166'),
('e9f1d776-1e5a-42a0-8cd2-5261caf14da2','91751941','42000174');
DO $$ BEGIN IF (SELECT count(*) FROM railway_carriage ) <> 17 OR EXISTS(SELECT 1 FROM map_railway_carriage m LEFT JOIN railway_carriage t ON t.id=m.id WHERE t.code IS DISTINCT FROM m.old_code) THEN RAISE EXCEPTION 'Stale mapping: railway_carriage'; END IF; END $$;
UPDATE railway_carriage t SET code=m.new_code FROM map_railway_carriage m WHERE t.id=m.id;
CREATE TEMP TABLE map_waybill_zpu(id uuid primary key,old_code text,new_code text) ON COMMIT DROP;
INSERT INTO map_waybill_zpu VALUES
('058d0ff8-dc3d-4ef3-a5fd-4a2bda9a868f','MVPZ-89C65CF26C34','7000004'),
('0ef99285-1382-4591-a5d9-c5c4f92106b6','MVPZ-C8B99C48D251','7000005'),
('2cda97f5-4bf7-4fc7-bb60-8e152d81727b','MVPZ-D62A3E697AF7','7000006'),
('3958805c-1a52-47cd-bce5-9af956d78763','MVPZ-0F47792D5237','7000002'),
('7513ccca-cbb6-4c51-8403-3f3b1b4ff792','235','7000001'),
('7c93676d-b1ae-40d0-a363-e9fd1371a5a8','MVPZ-DFC4534C553B','7000007'),
('b1c8f763-621b-4060-bced-79c63e86b49a','MVPZ-26B5D8B42719','7000003'),
('b730560b-d53b-4a94-8973-7fae7dc8451d','235','7000001'),
('e8aae4ba-4941-474b-b9d5-d3d7c8acbf84','MVPZ-FBE54FF1EBAC','7000008');
DO $$ BEGIN IF (SELECT count(*) FROM waybill_zpu ) <> 9 OR EXISTS(SELECT 1 FROM map_waybill_zpu m LEFT JOIN waybill_zpu t ON t.id=m.id WHERE t.zpu IS DISTINCT FROM m.old_code) THEN RAISE EXCEPTION 'Stale mapping: waybill_zpu'; END IF; END $$;
UPDATE waybill_zpu t SET zpu=m.new_code FROM map_waybill_zpu m WHERE t.id=m.id;
CREATE TEMP TABLE map_receiving_order_container(id uuid primary key,old_code text,new_code text) ON COMMIT DROP;
INSERT INTO map_receiving_order_container VALUES
('0e05158c-7ead-4e1a-b390-61b450d5d69b','MVPZ-FBE54FF1EBAC','7000008'),
('14ec211e-e949-46de-bf47-5abd33ab71d0','MVPZ-0F47792D5237','7000002'),
('1d2f4ff8-2599-472e-b8d8-21cd07e8eb98','MVPZ-D62A3E697AF7','7000006'),
('64bef6a2-a59c-456d-aa4e-88bf96a9044e','235','7000001'),
('d0c41eaf-d3ad-4b37-a01f-c9052ee7d812','235','7000001');
DO $$ BEGIN IF (SELECT count(*) FROM receiving_order_container WHERE seal_numbers IS NOT NULL) <> 5 OR EXISTS(SELECT 1 FROM map_receiving_order_container m LEFT JOIN receiving_order_container t ON t.id=m.id WHERE t.seal_numbers IS DISTINCT FROM m.old_code) THEN RAISE EXCEPTION 'Stale mapping: receiving_order_container'; END IF; END $$;
UPDATE receiving_order_container t SET seal_numbers=m.new_code FROM map_receiving_order_container m WHERE t.id=m.id;
CREATE TEMP TABLE map_shipping_order_container(id uuid primary key,old_code text,new_code text) ON COMMIT DROP;
INSERT INTO map_shipping_order_container VALUES
('09a8063d-8dea-4ed0-9357-9a4fd307fa7a','235','7000001'),
('1588e15c-419f-4269-9af2-0abf3960528e','MVPZ-89C65CF26C34','7000004'),
('16553382-cbfd-4255-b57c-81d3836f2aba','MVPZ-C8B99C48D251','7000005'),
('1ee5bf65-3396-404c-befb-a00ff74d49ba','MVPZ-26B5D8B42719','7000003'),
('35fe1960-634a-4501-b827-ba7843db1db2','235','7000001'),
('a2062ee7-6017-4361-b684-2ddc3aa2fbe4','MVPZ-DFC4534C553B','7000007'),
('ae33fb15-b25b-4640-9610-b6d577247f69','MVPZ-0F47792D5237','7000002'),
('b53c9eb2-ff1e-429c-8292-39733b8a9f3a','MVPZ-FBE54FF1EBAC','7000008'),
('ee4cb1d4-3ab1-49b6-a3a4-dcea1d12b864','MVPZ-D62A3E697AF7','7000006');
DO $$ BEGIN IF (SELECT count(*) FROM shipping_order_container WHERE seal_numbers IS NOT NULL) <> 9 OR EXISTS(SELECT 1 FROM map_shipping_order_container m LEFT JOIN shipping_order_container t ON t.id=m.id WHERE t.seal_numbers IS DISTINCT FROM m.old_code) THEN RAISE EXCEPTION 'Stale mapping: shipping_order_container'; END IF; END $$;
UPDATE shipping_order_container t SET seal_numbers=m.new_code FROM map_shipping_order_container m WHERE t.id=m.id;
COMMIT;
