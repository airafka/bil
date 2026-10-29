update individual_service
   set name = regexp_replace(
           name,
           ' / (Порожний КТК|Гружёный КТК|Любое состояние КТК)$',
           ''
       )
 where name ~ ' / (Порожний КТК|Гружёный КТК|Любое состояние КТК)$';

alter table individual_service
    drop constraint ck_individual_service_container_state,
    drop column container_state;
