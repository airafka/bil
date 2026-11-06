package ru.billing.app.comprehensiveserviceorder;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record CreateComprehensiveServiceOrderRequest(
        @NotNull(message = "Клиент обязателен") UUID clientId,
        @NotNull(message = "Договор обязателен") UUID contractId,
        @NotEmpty(message = "Выберите хотя бы одну накладную") List<@NotNull UUID> waybillIds,
        UUID defaultContainerOwnerId,
        @NotNull(message = "Выберите услугу") UUID complexServiceId,
        @Size(max = 10000) List<@NotNull @Valid ContainerOwner> containerOwners
) {
    public record ContainerOwner(@NotNull UUID containerId, @NotNull UUID ownerClientId) {}
    public CreateComprehensiveServiceOrderRequest { containerOwners = containerOwners == null ? List.of() : List.copyOf(containerOwners); }
    public CreateComprehensiveServiceOrderRequest(UUID clientId,UUID contractId,List<UUID> waybillIds,UUID defaultContainerOwnerId,UUID complexServiceId) { this(clientId,contractId,waybillIds,defaultContainerOwnerId,complexServiceId,List.of()); }
    public CreateComprehensiveServiceOrderRequest(UUID clientId,UUID contractId,List<UUID> waybillIds) {this(clientId,contractId,waybillIds,null,null);}
}
