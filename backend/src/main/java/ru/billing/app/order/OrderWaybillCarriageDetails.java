package ru.billing.app.order;

import java.util.List;
import java.util.UUID;

public record OrderWaybillCarriageDetails(
        UUID id,
        UUID railwayCarriageId,
        String number,
        String typeName,
        String modelName,
        java.math.BigDecimal loadCapacity,
        java.time.LocalDate nextDepotRepairDate,
        List<OrderWaybillContainerDetails> containers
) {
}
