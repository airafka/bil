package ru.billing.app.order;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

public record RailwayCarriageQuantityRequest(
        @NotNull(message = "Количество вагонов обязательно")
        Integer quantity,
        UUID typeId
) {
}
