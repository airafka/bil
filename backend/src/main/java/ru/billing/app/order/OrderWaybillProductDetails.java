package ru.billing.app.order;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderWaybillProductDetails(
        UUID id,
        UUID etsngCodeId,
        String etsngCode,
        BigDecimal weight, BigDecimal grossWeight, UUID hazardClassId, String hazardClassName
) {
}
