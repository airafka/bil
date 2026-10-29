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
        List<@NotNull @Valid WaybillRailwayCarriageRequest> railwayCarriages
) {}
