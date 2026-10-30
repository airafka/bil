package ru.billing.app.reference;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
public record UpdateContainerAttributesRequest(
    @NotNull @Positive @Digits(integer=12, fraction=3) BigDecimal tareWeight,
    @Positive @Digits(integer=12, fraction=3) BigDecimal loadCapacity
) {}
