package ru.billing.app.route;

import java.util.UUID;

public record RouteOrderOption(UUID id, int code, String clientName, String status) {}
