package ru.billing.app.order;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderCargoDetails(
        UUID etsngCodeId,
        String etsngCodeName,
        BigDecimal weight
) {
}
