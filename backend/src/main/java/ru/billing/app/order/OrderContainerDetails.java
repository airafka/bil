package ru.billing.app.order;

import java.util.UUID;

public record OrderContainerDetails(
        UUID containerId,
        String containerName,
        boolean empty,
        OrderCargoDetails cargo
) {
}
