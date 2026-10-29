package ru.billing.app.complexservice;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

public record ComplexServiceTariffRequest(
        @NotNull UUID clientId,
        @NotNull UUID contractId,
        @NotNull @DecimalMin("0.0001") @Digits(integer = 8, fraction = 4) BigDecimal coefficient
) {}
