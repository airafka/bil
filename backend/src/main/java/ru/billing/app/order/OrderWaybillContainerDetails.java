package ru.billing.app.order;

import java.util.UUID;

public record OrderWaybillContainerDetails(
        UUID containerId,
        String number,
        java.math.BigDecimal grossWeight,
        java.math.BigDecimal tareWeight,
        java.math.BigDecimal netWeight,
        UUID etsngCodeId,
        String etsngCodeName,
        UUID ownerClientId, String ownerClientName, String sealNumbers, UUID sealTypeId, String sealTypeName, String type, java.math.BigDecimal loadCapacity
) {
}
