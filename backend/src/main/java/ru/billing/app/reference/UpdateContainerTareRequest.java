package ru.billing.app.reference;
import java.math.BigDecimal;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
public record UpdateContainerTareRequest(
        @NotNull(message = "Укажите массу тары")
        @DecimalMin(value = "0.001", message = "Масса тары должна быть больше нуля")
        @Digits(integer = 13, fraction = 3, message = "Допустимо не более трёх знаков после запятой") BigDecimal tareWeight
) {}
