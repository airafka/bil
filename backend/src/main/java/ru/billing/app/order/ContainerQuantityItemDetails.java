package ru.billing.app.order;

import java.math.BigDecimal;
import java.util.UUID;

public record ContainerQuantityItemDetails(
        UUID id,
        UUID etsngCodeId,
        String etsngCode,
        BigDecimal weight
) {
}
