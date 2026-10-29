package ru.billing.app.order;

import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record OrderContainerRequest(
        @NotNull(message = "КТК обязателен")
        UUID containerId,

        @NotNull(message = "Признак порожнего КТК обязателен")
        Boolean empty,

        @Valid
        CargoRequest cargo
) {
}

