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
        UUID carrierId,
        UUID driverId,
        UUID vehicleId,
        String comment,
        @NotNull List<UUID> orderIds
) {}
