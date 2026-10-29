package ru.billing.app.waybill;

import java.math.BigDecimal;
import java.util.UUID;

public record WaybillProductSummary(
        UUID id,
        UUID etsngCodeId,
        String code,
        String name,
        BigDecimal weight
) {
}
