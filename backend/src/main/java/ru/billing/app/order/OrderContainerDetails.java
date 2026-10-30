package ru.billing.app.order;

import java.util.UUID;

public record OrderContainerDetails(
        UUID containerId,
        String containerName,
        boolean empty,
        OrderCargoDetails cargo,
        UUID ownerClientId, String ownerClientName,
        String sealNumbers,
        UUID sealTypeId, String sealTypeName,
        UUID hazardClassId, String hazardClassName
) {
    public OrderContainerDetails(UUID containerId, String containerName, boolean empty, OrderCargoDetails cargo) {
        this(containerId, containerName, empty, cargo, null, null, null, null, null, null, null);
    }
}
