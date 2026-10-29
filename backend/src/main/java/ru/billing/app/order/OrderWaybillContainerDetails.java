package ru.billing.app.order;

import java.util.UUID;

public record OrderWaybillContainerDetails(
        UUID containerId,
        String number,
        java.math.BigDecimal grossWeight,
        java.math.BigDecimal tareWeight,
        java.math.BigDecimal netWeight,
        UUID etsngCodeId,
        String etsngCodeName
) {
}
