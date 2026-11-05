package ru.billing.app.route;

import java.time.OffsetDateTime;
import java.util.UUID;
import ru.billing.app.order.TransportType;

public record RouteSummary(UUID id, int code, RouteType routeType, OffsetDateTime departureAt,
        UUID terminalAreaId, String terminalAreaName, TransportType transportType,
        String carrier, String driverName, String vehicleNumber, String comment,
        String status, int orderCount, java.util.List<Integer> orderNumbers, UUID carrierId, UUID driverId, UUID vehicleId,
        String phoneNumber, String poaNumber, java.time.LocalDate poaValidTo, String insuranceNumber, Boolean withTrailer, String trailerNumber) {}
