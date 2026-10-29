package ru.billing.app.order;

import java.math.BigDecimal;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

public record CargoRequest(
        @NotNull(message = "Груз обязателен")
        UUID etsngCodeId,

        @NotNull(message = "Масса обязательна")
        @DecimalMin(value = "0.001", message = "Масса должна быть больше нуля")
        @Digits(integer = 12, fraction = 3, message = "Масса должна содержать не более трёх знаков после запятой")
        BigDecimal weight
) {
}

