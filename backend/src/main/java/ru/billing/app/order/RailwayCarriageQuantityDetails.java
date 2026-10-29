package ru.billing.app.order;

import java.util.UUID;

public record RailwayCarriageQuantityDetails(
        UUID id,
        int quantity,
        UUID typeId,
        String typeCode,
        String typeName
) {
}
