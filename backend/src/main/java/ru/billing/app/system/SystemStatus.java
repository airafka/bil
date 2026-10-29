package ru.billing.app.system;

import java.time.Instant;

public record SystemStatus(
        String service,
        String status,
        String database,
        Instant timestamp
) {
}

