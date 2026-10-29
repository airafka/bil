package ru.billing.app.waybill;

import java.util.List;

public record GroupedWaybillRow(
        String groupKey,
        int departureStation,
        int destinationStation,
        String payer,
        List<WaybillProductSummary> products,
        long railwayCarriageCount,
        long containerCount,
        long waybillCount,
        List<WaybillLink> waybills
) {
}
