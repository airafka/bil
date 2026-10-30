package ru.billing.app.waybill;
import java.math.BigDecimal;
import java.util.UUID;
public record WaybillContainerSummary(UUID containerId, String number, BigDecimal grossWeight,
        BigDecimal tareWeight, BigDecimal netWeight, UUID etsngCodeId, String etsngCodeName,
        UUID ownerClientId, String ownerClientName, String sealNumbers, UUID sealTypeId, String sealTypeName, String type, java.math.BigDecimal loadCapacity) {}
