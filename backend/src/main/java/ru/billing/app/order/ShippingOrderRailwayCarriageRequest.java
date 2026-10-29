package ru.billing.app.order;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ShippingOrderRailwayCarriageRequest(
        @NotNull(message = "Вагон обязателен")
        UUID railwayCarriageId,

        List<@NotNull(message = "Данные КТК обязательны") @Valid OrderContainerRequest> containers
) {
}
