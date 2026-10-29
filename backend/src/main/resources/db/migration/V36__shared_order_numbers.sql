-- Preserve the former per-type numbers for reconciliation; relations use UUIDs.
alter table service_order add column legacy_code integer;
alter table receiving_order add column legacy_code integer;
alter table shipping_order add column legacy_code integer;
update service_order set legacy_code=code;
update receiving_order set legacy_code=code;
update shipping_order set legacy_code=code;

create temporary table order_number_map on commit drop as
select kind,id,row_number() over(order by created_at nulls last,parent_id,stage,old_code,id)::integer as new_code
from (
    select 'service' as kind,s.id,s.created_at,s.id as parent_id,0 as stage,s.code as old_code from service_order s
    union all
    select 'receiving',r.id,s.created_at,coalesce(s.id,r.id),case when r.service_role='RETURN_RECEIVING' then 3 else 1 end,r.code
    from receiving_order r left join service_order s on s.id=r.service_order_id
    union all
    select 'shipping',sh.id,s.created_at,coalesce(s.id,sh.id),2,sh.code
    from shipping_order sh left join service_order s on s.id=sh.service_order_id
) all_orders;

alter table service_order alter column code drop identity;
alter table receiving_order alter column code drop identity;
alter table shipping_order alter column code drop identity;
update service_order set code=-code;
update receiving_order set code=-code;
update shipping_order set code=-code;
update service_order s set code=m.new_code from order_number_map m where m.kind='service' and m.id=s.id;
update receiving_order r set code=m.new_code from order_number_map m where m.kind='receiving' and m.id=r.id;
update shipping_order sh set code=m.new_code from order_number_map m where m.kind='shipping' and m.id=sh.id;

create sequence order_code_seq as integer;
select setval('order_code_seq',coalesce(max(new_code),0)+1,false) from order_number_map;
alter table service_order alter column code set default nextval('order_code_seq');
alter table receiving_order alter column code set default nextval('order_code_seq');
alter table shipping_order alter column code set default nextval('order_code_seq');
