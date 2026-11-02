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
        UUID hazardClassId, String hazardClassName,
        java.util.List<OrderCargoDetails> cargoItems, String containerStatus
) {
    public OrderContainerDetails(UUID containerId, String containerName, boolean empty, OrderCargoDetails cargo,
            UUID ownerClientId, String ownerClientName, String sealNumbers, UUID sealTypeId, String sealTypeName,
            UUID hazardClassId, String hazardClassName, java.util.List<OrderCargoDetails> cargoItems) {
        this(containerId,containerName,empty,cargo,ownerClientId,ownerClientName,sealNumbers,sealTypeId,sealTypeName,hazardClassId,hazardClassName,cargoItems,null);
    }
    public OrderContainerDetails(UUID containerId, String containerName, boolean empty, OrderCargoDetails cargo,
            UUID ownerClientId, String ownerClientName, String sealNumbers, UUID sealTypeId, String sealTypeName,
            UUID hazardClassId, String hazardClassName) {
        this(containerId, containerName, empty, cargo, ownerClientId, ownerClientName, sealNumbers, sealTypeId,
                sealTypeName, hazardClassId, hazardClassName, cargo == null ? java.util.List.of() : java.util.List.of(cargo));
    }
    public static java.util.List<OrderContainerDetails> merge(java.util.List<OrderContainerDetails> rows) {
        var grouped = new java.util.LinkedHashMap<UUID, java.util.List<OrderContainerDetails>>();
        rows.forEach(row -> grouped.computeIfAbsent(row.containerId(), ignored -> new java.util.ArrayList<>()).add(row));
        return grouped.values().stream().map(values -> {
            var first = values.getFirst();
            var items = values.stream().flatMap(v -> v.cargoItems().stream()).toList();
            return new OrderContainerDetails(first.containerId(), first.containerName(), first.empty(),
                    items.isEmpty() ? null : items.getFirst(), first.ownerClientId(), first.ownerClientName(), first.sealNumbers(),
                    first.sealTypeId(), first.sealTypeName(), first.hazardClassId(), first.hazardClassName(), items, first.containerStatus());
        }).toList();
    }
    public OrderContainerDetails(UUID containerId, String containerName, boolean empty, OrderCargoDetails cargo) {
        this(containerId, containerName, empty, cargo, null, null, null, null, null, null, null);
    }
}
