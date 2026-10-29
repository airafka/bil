package ru.billing.app.waybill;

public record GroupedWaybillRequest(
        WaybillFilter filter,
        PageInfo pageInfo,
        String sortingColumn,
        String sortingDirection,
        Boolean availableForReceivingOrderOnly
) {
}
