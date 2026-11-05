package ru.billing.app.waybill;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record WaybillCarriageSummary(UUID id, String number, List<WaybillContainerSummary> containers,
        String typeName, String modelName, BigDecimal loadCapacity, LocalDate nextDepotRepairDate) {}
