ALTER TABLE client_related_entity ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE client_driver ADD COLUMN active boolean NOT NULL DEFAULT true,
 ADD COLUMN phone_number varchar(30), ADD COLUMN poa_number varchar(100), ADD COLUMN poa_valid_to date;
ALTER TABLE client_vehicle ADD COLUMN active boolean NOT NULL DEFAULT true,
 ADD COLUMN insurance_number varchar(100), ADD COLUMN with_trailer boolean,
 ADD COLUMN trailer_number varchar(20);
-- Existing vehicle trailer state is unknown; keep NULL instead of inventing false.
ALTER TABLE client_vehicle ADD CONSTRAINT vehicle_trailer_consistency CHECK
 ((with_trailer IS TRUE AND nullif(trim(trailer_number),'') IS NOT NULL)
 OR (with_trailer IS NOT TRUE AND trailer_number IS NULL));
