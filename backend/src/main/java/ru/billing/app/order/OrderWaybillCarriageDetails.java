package ru.billing.app.order;

import java.util.List;
import java.util.UUID;

public record OrderWaybillCarriageDetails(
        UUID id,
        UUID railwayCarriageId,
        String number,
        List<OrderWaybillContainerDetails> containers
) {
}
