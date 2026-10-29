package ru.billing.app.complexservice;

import java.math.BigDecimal;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ComplexServiceRequest(
        @NotBlank(message = "Укажите наименование услуги")
        @Size(max = 255) String name,
        @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal priceWithoutVat,
        @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal priceWithVat
) {}
