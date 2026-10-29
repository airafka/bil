package ru.billing.app.order;

import java.util.List;
import java.util.UUID;

public record ShippingOrderRailwayCarriageDetails(
        UUID railwayCarriageId,
        String railwayCarriageCode,
        List<OrderContainerDetails> containers
) {
}
