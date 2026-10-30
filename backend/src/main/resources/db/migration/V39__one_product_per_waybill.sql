-- Refuse unreviewed conflicting data in another installation.
do $$ begin
    if exists (
        select p.waybill_id from waybill_product p join waybill w on w.id = p.waybill_id
        where w.number not in ('1743125937', '1743125939')
        group by p.waybill_id having count(distinct p.etsng_code_id) > 1
    ) then raise exception 'Conflicting waybill cargo requires review before V39'; end if;
end $$;
-- Keep one cargo per waybill. For conflicting historical cargo, the user
-- approved retaining the first ETSNG code. A full database backup was taken.
delete from waybill_product where id in (
    select id from (
        select p.id, row_number() over (partition by p.waybill_id order by e.code, p.id) as position
        from waybill_product p join etsng_code e on e.id = p.etsng_code_id
    ) ranked where position > 1
);
alter table waybill_product drop column waybill_container_id;
alter table waybill_product add constraint uq_waybill_product_waybill unique (waybill_id);
