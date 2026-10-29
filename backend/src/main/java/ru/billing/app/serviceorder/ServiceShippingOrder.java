package ru.billing.app.serviceorder;

import java.util.List;
import java.util.UUID;

public record ServiceShippingOrder(UUID id, int code, String status, List<String> containerNames, UUID returnReceivingOrderId) {}
