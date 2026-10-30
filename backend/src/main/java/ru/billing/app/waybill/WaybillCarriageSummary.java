package ru.billing.app.waybill;

import java.util.List;
import java.util.UUID;

public record WaybillCarriageSummary(UUID id, String number, List<WaybillContainerSummary> containers) {}
