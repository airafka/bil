package ru.billing.app.order;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record CreateOrderRequest(
    @NotNull(message = "Клиент обязателен") UUID clientId,
    @NotNull(message = "Договор обязателен") UUID contractId,
    @NotNull(message = "Площадка обязательна") UUID terminalAreaId,
    @NotNull(message = "Тип транспорта обязателен") TransportType transportType,
    List<@NotNull @Valid OrderContainerRequest> containers,
    List<@NotNull UUID> waybillIds,
    List<@NotNull @Valid ShippingOrderRailwayCarriageRequest> railwayCarriages,
    FillingType fillingType,
    List<@NotNull @Valid RailwayCarriageQuantityRequest> railwayCarriageQuantities,
    List<@NotNull @Valid ContainerQuantityRequest> containerQuantities,
    UUID routeId
) {
    public CreateOrderRequest(UUID clientId, UUID contractId, UUID terminalAreaId, TransportType transportType,
            List<OrderContainerRequest> containers, List<UUID> waybillIds,
            List<ShippingOrderRailwayCarriageRequest> railwayCarriages, FillingType fillingType,
            List<RailwayCarriageQuantityRequest> railwayCarriageQuantities,
            List<ContainerQuantityRequest> containerQuantities) {
        this(clientId, contractId, terminalAreaId, transportType, containers, waybillIds, railwayCarriages,
                fillingType, railwayCarriageQuantities, containerQuantities, null);
    }
}
