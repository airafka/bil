package ru.billing.app.waybill;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateWaybillRequest(
        UUID receivingOrderId,
        @NotNull(message = "Станция отправления обязательна") Integer departureStation,
        @NotNull(message = "Станция назначения обязательна") Integer destinationStation,
        @NotBlank(message = "Плательщик обязателен") String payer,
        UUID etsngCodeId,
        UUID hazardClassId,
        List<@NotNull @Valid WaybillRailwayCarriageRequest> railwayCarriages
) {
    public CreateWaybillRequest(UUID receivingOrderId, Integer departureStation, Integer destinationStation,
            String payer, UUID etsngCodeId, List<WaybillRailwayCarriageRequest> railwayCarriages) {
        this(receivingOrderId, departureStation, destinationStation, payer, etsngCodeId, null, railwayCarriages);
    }
    // Compatibility for callers using the previous per-container payload.
    public CreateWaybillRequest(UUID receivingOrderId, Integer departureStation, Integer destinationStation,
            String payer, List<WaybillRailwayCarriageRequest> railwayCarriages) {
        this(receivingOrderId, departureStation, destinationStation, payer, null, null, railwayCarriages);
    }
}
