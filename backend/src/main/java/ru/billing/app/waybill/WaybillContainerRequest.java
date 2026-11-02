package ru.billing.app.waybill;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.validation.constraints.NotNull;

public record WaybillContainerRequest(
        @NotNull(message = "Выберите КТК") UUID containerId,
        @NotNull(message = "Укажите массу брутто КТК") BigDecimal grossWeight,
        UUID etsngCodeId,
        UUID ownerClientId,
        @jakarta.validation.constraints.Size(max = 1000, message = "Номера ЗПУ: не более 1000 символов") String sealNumbers,
        UUID sealTypeId,
        BigDecimal netWeight,
        @jakarta.validation.constraints.Size(max = 255) String owner
) {
    public WaybillContainerRequest(UUID containerId, BigDecimal grossWeight, UUID etsngCodeId,
            UUID ownerClientId, String sealNumbers, UUID sealTypeId, BigDecimal netWeight) {
        this(containerId, grossWeight, etsngCodeId, ownerClientId, sealNumbers, sealTypeId, netWeight, null);
    }
    public WaybillContainerRequest(UUID containerId, BigDecimal grossWeight, UUID etsngCodeId,
            UUID ownerClientId, String sealNumbers, UUID sealTypeId) {
        this(containerId, grossWeight, etsngCodeId, ownerClientId, sealNumbers, sealTypeId, null);
    }
    public WaybillContainerRequest {
        owner = owner == null || owner.isBlank() ? null : owner.trim();
        sealNumbers = sealNumbers == null || sealNumbers.isBlank() ? null : sealNumbers.trim();
    }
    public WaybillContainerRequest(UUID containerId, BigDecimal grossWeight, UUID etsngCodeId) {
        this(containerId, grossWeight, etsngCodeId, null, null, null);
    }
}
