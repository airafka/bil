package ru.billing.app.reference;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.validation.constraints.*;
public record UpdateRailwayCarriageRequest(UUID modelId,
        @DecimalMin(value = "0", inclusive = false, message = "Грузоподъёмность должна быть положительной")
        @Digits(integer = 12, fraction = 3, message = "Грузоподъёмность: до 12 цифр и 3 знаков после запятой") BigDecimal loadCapacity,
        LocalDate nextDepotRepairDate, UUID carriageTypeId) {}
