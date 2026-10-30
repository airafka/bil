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
        UUID sealTypeId
) {
    public WaybillContainerRequest {
        sealNumbers = sealNumbers == null || sealNumbers.isBlank() ? null : sealNumbers.trim();
    }
    public WaybillContainerRequest(UUID containerId, BigDecimal grossWeight, UUID etsngCodeId) {
        this(containerId, grossWeight, etsngCodeId, null, null, null);
    }
}
