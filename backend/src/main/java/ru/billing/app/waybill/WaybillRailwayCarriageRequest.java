package ru.billing.app.waybill;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record WaybillRailwayCarriageRequest(
        @NotNull(message = "Выберите вагон") UUID railwayCarriageId,
        List<@NotNull @Valid WaybillContainerRequest> containers
) {}
