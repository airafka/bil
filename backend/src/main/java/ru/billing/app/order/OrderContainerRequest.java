package ru.billing.app.order;

import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record OrderContainerRequest(
        @NotNull(message = "КТК обязателен")
        UUID containerId,

        @NotNull(message = "Признак порожнего КТК обязателен")
        Boolean empty,

        @Valid
        CargoRequest cargo,
        UUID ownerClientId,
        @jakarta.validation.constraints.Size(max = 1000, message = "Номера ЗПУ: не более 1000 символов")
        String sealNumbers,
        UUID sealTypeId,
        UUID hazardClassId,
        java.util.List<@Valid CargoRequest> cargoItems
) {
    public OrderContainerRequest {
        sealNumbers = sealNumbers == null || sealNumbers.isBlank() ? null : sealNumbers.trim();
        cargoItems = cargoItems == null ? (cargo == null ? java.util.List.of() : java.util.List.of(cargo)) : java.util.List.copyOf(cargoItems);
        if (cargo == null && !cargoItems.isEmpty()) cargo = cargoItems.getFirst();
    }
    public OrderContainerRequest(UUID containerId, Boolean empty, CargoRequest cargo, UUID ownerClientId,
            String sealNumbers, UUID sealTypeId, UUID hazardClassId) {
        this(containerId, empty, cargo, ownerClientId, sealNumbers, sealTypeId, hazardClassId, null);
    }
    public OrderContainerRequest(UUID containerId, Boolean empty, CargoRequest cargo) {
        this(containerId, empty, cargo, null, null, null, null);
    }
}

