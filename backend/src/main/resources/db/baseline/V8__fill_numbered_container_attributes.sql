-- Fill only absent source attributes in drafts. Owners and completed documents are untouched.
with source as (select w.receiving_order_id, wc.container_id,
    case when count(distinct wc.seal_numbers)=1 then min(wc.seal_numbers) end as seal_numbers,
    case when count(distinct wc.seal_type_id)=1 then (array_agg(distinct wc.seal_type_id) filter(where wc.seal_type_id is not null))[1] end as seal_type_id,
    case when count(distinct hazard.danger_class_id)=1 then (array_agg(distinct hazard.danger_class_id) filter(where hazard.danger_class_id is not null))[1] end as danger_class_id
from waybill w join waybill_railway_carriage rc on rc.waybill_id=w.id
join waybill_container_details wc on wc.waybill_railway_carriage_id=rc.id
left join lateral (
    select case when count(distinct dp.danger_class_id)=1 then (array_agg(distinct dp.danger_class_id))[1] end as danger_class_id
    from waybill_product wp join danger_product dp on dp.id=wp.danger_product_id where wp.waybill_id=w.id
) hazard on wc.net_weight>0
group by w.receiving_order_id,wc.container_id)
update receiving_order_container oc set seal_numbers=coalesce(oc.seal_numbers,src.seal_numbers),
    seal_type_id=coalesce(oc.seal_type_id,src.seal_type_id),danger_class_id=coalesce(oc.danger_class_id,src.danger_class_id)
from receiving_order r,source src where r.id=oc.receiving_order_id and r.order_status='DRAFT' and r.transport_type='RAILWAY'
    and src.receiving_order_id=r.id and src.container_id=oc.container_id;
with source as (select w.receiving_order_id, wc.container_id,
    case when count(distinct wc.seal_numbers)=1 then min(wc.seal_numbers) end as seal_numbers,
    case when count(distinct wc.seal_type_id)=1 then (array_agg(distinct wc.seal_type_id) filter(where wc.seal_type_id is not null))[1] end as seal_type_id,
    case when count(distinct hazard.danger_class_id)=1 then (array_agg(distinct hazard.danger_class_id) filter(where hazard.danger_class_id is not null))[1] end as danger_class_id
from waybill w join waybill_railway_carriage rc on rc.waybill_id=w.id
join waybill_container_details wc on wc.waybill_railway_carriage_id=rc.id
left join lateral (
    select case when count(distinct dp.danger_class_id)=1 then (array_agg(distinct dp.danger_class_id))[1] end as danger_class_id
    from waybill_product wp join danger_product dp on dp.id=wp.danger_product_id where wp.waybill_id=w.id
) hazard on wc.net_weight>0
group by w.receiving_order_id,wc.container_id)
update shipping_order_container sc set seal_numbers=coalesce(sc.seal_numbers,roc.seal_numbers,src.seal_numbers),
    seal_type_id=coalesce(sc.seal_type_id,roc.seal_type_id,src.seal_type_id),danger_class_id=coalesce(sc.danger_class_id,roc.danger_class_id,src.danger_class_id)
from shipping_order s join source src on src.receiving_order_id=s.source_receiving_order_id
left join receiving_order_container roc on roc.receiving_order_id=s.source_receiving_order_id and roc.container_id=src.container_id
where s.id=sc.shipping_order_id and src.container_id=sc.container_id and s.order_status='DRAFT' and s.comprehensive_service_order_id is not null;
