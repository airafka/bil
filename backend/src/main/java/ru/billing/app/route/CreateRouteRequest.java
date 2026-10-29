package ru.billing.app.route;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.NotNull;
import ru.billing.app.order.TransportType;

public record CreateRouteRequest(
        @NotNull RouteType routeType,
        @NotNull OffsetDateTime departureAt,
        @NotNull UUID terminalAreaId,
        @NotNull TransportType transportType,
        String carrier,
        String driverName,
        String vehicleNumber,
        String comment,
        @NotNull List<UUID> orderIds
) {}
