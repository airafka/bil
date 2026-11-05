package ru.billing.app.order;
import java.util.List;
import java.util.UUID;
import java.time.LocalDateTime;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
    UUID routeId,
    LocalDateTime arrivalAt,
    @Size(max = 255, message = "Грузоотправитель: не более 255 символов") String consignor,
    LocalDateTime departureAt,
    @Size(max = 255, message = "Грузополучатель: не более 255 символов") String consignee,
    UUID defaultContainerOwnerId,
    @Size(max = 255) String authorizedRepresentative,
    @Size(max = 50) String phone,
    @jakarta.validation.constraints.Email(message = "Укажите корректный email") @Size(max = 254) String email,
    @Size(max = 4000) String comment,
    @Size(max = 255, message = "Номер транспортной накладной: не более 255 символов") String transportWaybillNumber
) {
    public UUID effectiveDefaultContainerOwnerId() { return defaultContainerOwnerId; }
    public CreateOrderRequest withDefaultContainerOwner(UUID owner) {
        return new CreateOrderRequest(clientId,contractId,terminalAreaId,transportType,containers,waybillIds,railwayCarriages,
            fillingType,railwayCarriageQuantities,containerQuantities,routeId,arrivalAt,consignor,departureAt,consignee,owner,authorizedRepresentative,phone,email,comment,transportWaybillNumber);
    }
    public CreateOrderRequest(UUID clientId,UUID contractId,UUID terminalAreaId,TransportType transportType,
            List<OrderContainerRequest> containers,List<UUID> waybillIds,List<ShippingOrderRailwayCarriageRequest> railwayCarriages,
            FillingType fillingType,List<RailwayCarriageQuantityRequest> railwayCarriageQuantities,List<ContainerQuantityRequest> containerQuantities,
            UUID routeId,LocalDateTime arrivalAt,String consignor,LocalDateTime departureAt,String consignee) {
        this(clientId,contractId,terminalAreaId,transportType,containers,waybillIds,railwayCarriages,fillingType,
            railwayCarriageQuantities,containerQuantities,routeId,arrivalAt,consignor,departureAt,consignee,null);
    }
    public CreateOrderRequest(UUID clientId,UUID contractId,UUID terminalAreaId,TransportType transportType,
            List<OrderContainerRequest> containers,List<UUID> waybillIds,List<ShippingOrderRailwayCarriageRequest> railwayCarriages,
            FillingType fillingType,List<RailwayCarriageQuantityRequest> railwayCarriageQuantities,List<ContainerQuantityRequest> containerQuantities,
            UUID routeId,LocalDateTime arrivalAt,String consignor,LocalDateTime departureAt,String consignee,UUID defaultContainerOwnerId) {
        this(clientId,contractId,terminalAreaId,transportType,containers,waybillIds,railwayCarriages,fillingType,
            railwayCarriageQuantities,containerQuantities,routeId,arrivalAt,consignor,departureAt,consignee,defaultContainerOwnerId,null,null,null,null);
    }
    public CreateOrderRequest(UUID clientId, UUID contractId, UUID terminalAreaId, TransportType transportType,
            List<OrderContainerRequest> containers, List<UUID> waybillIds, List<ShippingOrderRailwayCarriageRequest> railwayCarriages,
            FillingType fillingType, List<RailwayCarriageQuantityRequest> railwayCarriageQuantities, List<ContainerQuantityRequest> containerQuantities,
            UUID routeId, LocalDateTime arrivalAt, String consignor, LocalDateTime departureAt, String consignee, UUID defaultContainerOwnerId,
            String authorizedRepresentative, String phone, String email, String comment) {
        this(clientId,contractId,terminalAreaId,transportType,containers,waybillIds,railwayCarriages,fillingType,
            railwayCarriageQuantities,containerQuantities,routeId,arrivalAt,consignor,departureAt,consignee,defaultContainerOwnerId,
            authorizedRepresentative,phone,email,comment,null);
    }
    public CreateOrderRequest {
        transportWaybillNumber = clean(transportWaybillNumber);
        authorizedRepresentative = clean(authorizedRepresentative);
        phone = clean(phone);
        email = clean(email);
        comment = clean(comment);
        consignor = consignor == null || consignor.isBlank() ? null : consignor.strip();
        consignee = consignee == null || consignee.isBlank() ? null : consignee.strip();
    }

    public CreateOrderRequest(UUID clientId, UUID contractId, UUID terminalAreaId, TransportType transportType,
            List<OrderContainerRequest> containers, List<UUID> waybillIds,
            List<ShippingOrderRailwayCarriageRequest> railwayCarriages, FillingType fillingType,
            List<RailwayCarriageQuantityRequest> railwayCarriageQuantities,
            List<ContainerQuantityRequest> containerQuantities, UUID routeId) {
        this(clientId, contractId, terminalAreaId, transportType, containers, waybillIds, railwayCarriages,
                fillingType, railwayCarriageQuantities, containerQuantities, routeId, null, null, null, null);
    }

    public CreateOrderRequest(UUID clientId, UUID contractId, UUID terminalAreaId, TransportType transportType,
            List<OrderContainerRequest> containers, List<UUID> waybillIds,
            List<ShippingOrderRailwayCarriageRequest> railwayCarriages, FillingType fillingType,
            List<RailwayCarriageQuantityRequest> railwayCarriageQuantities,
            List<ContainerQuantityRequest> containerQuantities) {
        this(clientId, contractId, terminalAreaId, transportType, containers, waybillIds, railwayCarriages,
                fillingType, railwayCarriageQuantities, containerQuantities, null);
    }
    private static String clean(String value) { return value == null || value.isBlank() ? null : value.strip(); }
}
