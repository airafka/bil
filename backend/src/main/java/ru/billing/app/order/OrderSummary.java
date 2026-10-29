package ru.billing.app.order;

import java.util.UUID;

public record OrderSummary(
        UUID id,
        Integer code,
        UUID clientId,
        String clientName,
        TerminalAreaDetails terminalArea,
        TransportType transportType,
        FillingType fillingType,
        String status,
        UUID contractId,
        String contractName,
        UUID serviceOrderId
) {
}
