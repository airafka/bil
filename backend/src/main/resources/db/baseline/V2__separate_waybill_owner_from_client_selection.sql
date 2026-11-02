-- A waybill owner is source text. An order container owner is an explicitly selected client.
-- Refuse to guess a mapping for historical counterparties that have no client with the same ID.
do $$ begin
    if exists(select 1 from receiving_order_container r where r.owner_container_id is not null
              and not exists(select 1 from client c where c.id=r.owner_container_id))
       or exists(select 1 from shipping_order_container s where s.owner_container_id is not null
              and not exists(select 1 from client c where c.id=s.owner_container_id)) then
        raise exception 'An existing container owner needs explicit client mapping';
    end if;
end $$;
alter table receiving_order_container drop constraint receiving_order_container_owner_container_id_fkey;
alter table receiving_order_container add constraint receiving_order_container_owner_container_id_fkey
    foreign key(owner_container_id) references client(id) on delete restrict;
alter table shipping_order_container drop constraint shipping_order_container_owner_container_id_fkey;
alter table shipping_order_container add constraint shipping_order_container_owner_container_id_fkey
    foreign key(owner_container_id) references client(id) on delete restrict;

create or replace view waybill_container_details as
select wc.*, null::uuid as owner_container_id, wc.owner as owner_container_name,
       z.seal_numbers, st.id as seal_type_id, z.zpu_type as seal_type_name
from waybill_container wc
left join lateral (
    select string_agg(zpu, ', ' order by zpu) as seal_numbers, min(zpu_type) as zpu_type
    from waybill_zpu where waybill_container_id=wc.id
) z on true
left join seal_type st on st.code=z.zpu_type;
