package ru.billing.app.waybill;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.validation.constraints.NotNull;

public record WaybillContainerRequest(
        @NotNull(message = "Выберите КТК") UUID containerId,
        @NotNull(message = "Укажите массу брутто КТК") BigDecimal grossWeight,
        UUID etsngCodeId
) {}
