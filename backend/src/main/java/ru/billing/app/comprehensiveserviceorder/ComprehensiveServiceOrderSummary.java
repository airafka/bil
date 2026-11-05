package ru.billing.app.comprehensiveserviceorder;

import java.util.UUID;

public record ComprehensiveServiceOrderSummary(
        UUID id, int code, UUID clientId, String clientName,
        UUID contractId, String contractName, String status, int shippingOrderCount, java.time.OffsetDateTime createdAt
) {}
