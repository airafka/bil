package ru.billing.app.route;

import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.NotNull;

public record AssignRouteOrdersRequest(@NotNull List<UUID> orderIds) {}
