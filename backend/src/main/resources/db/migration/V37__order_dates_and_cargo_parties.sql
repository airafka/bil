alter table receiving_order
    add column arrival_at timestamp without time zone,
    add column consignor varchar(255);

alter table shipping_order
    add column departure_at timestamp without time zone,
    add column consignee varchar(255);
