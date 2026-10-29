package ru.billing.app.order;

import java.util.UUID;

public record CreatedOrderResponse(UUID id, Integer code, String status) {
}

