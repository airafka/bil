package ru.billing.app.route;

import java.util.List;

public record RouteDetails(RouteSummary route, List<RouteOrderOption> orders) {}
