package ru.billing.app.serviceorder;

import java.util.UUID;

public record ServiceOrderSummary(
        UUID id, int code, UUID clientId, String clientName,
        UUID contractId, String contractName, String status, int shippingOrderCount
) {}
