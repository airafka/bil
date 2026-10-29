create sequence waybill_number_seq
    as bigint
    start with 1743125934
    increment by 1;

select setval(
    'waybill_number_seq',
    greatest(
        1743125934,
        coalesce(
            (select max(number::bigint) + 1 from waybill where number ~ '^[0-9]+$'),
            1743125934
        )
    ),
    false
);

alter table waybill
    alter column number set default nextval('waybill_number_seq')::text;

create unique index uq_waybill_number on waybill(number);
