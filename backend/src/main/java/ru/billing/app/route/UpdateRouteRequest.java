package ru.billing.app.route;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.List;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
public record UpdateRouteRequest(@NotNull OffsetDateTime departureAt,UUID carrierId,UUID driverId,UUID vehicleId,
 @Size(max=200) String comment,@NotNull List<UUID> orderIds) {}
