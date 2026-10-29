package ru.billing.app.order;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ContainerQuantityRequest(
        @NotNull(message = "Количество КТК обязательно")
        Integer quantity,
        @NotNull(message = "Тип КТК обязателен")
        ContainerType type,
        @NotNull(message = "Признак порожнего КТК обязателен")
        Boolean empty,
        List<@NotNull(message = "Данные груза обязательны") @Valid CargoRequest> items
) {
}
