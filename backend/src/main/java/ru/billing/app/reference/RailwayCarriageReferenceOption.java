package ru.billing.app.reference;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;
public record RailwayCarriageReferenceOption(UUID id, String name, UUID modelId, String modelName,
        BigDecimal loadCapacity, LocalDate nextDepotRepairDate, UUID carriageTypeId, String carriageTypeName) {}
