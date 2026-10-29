package ru.billing.app.route;

import java.time.OffsetDateTime;
import java.util.UUID;
import ru.billing.app.order.TransportType;

public record RouteSummary(UUID id, int code, RouteType routeType, OffsetDateTime departureAt,
        UUID terminalAreaId, String terminalAreaName, TransportType transportType,
        String carrier, String driverName, String vehicleNumber, String comment,
        String status, int orderCount) {}
