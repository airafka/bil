package ru.billing.app.waybill;

import java.util.List;
import java.util.UUID;

public record WaybillLink(
        UUID id,
        String number,
        long railwayCarriageCount,
        long containerCount,
        List<WaybillProductSummary> products,
        List<WaybillContainerSummary> containers
) {
}
