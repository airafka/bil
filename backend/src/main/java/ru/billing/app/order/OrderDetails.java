package ru.billing.app.order;

import java.util.List;
import java.util.UUID;
import java.time.LocalDateTime;

public record OrderDetails(
        UUID id,
        int code,
        UUID clientId,
        String clientName,
        TerminalAreaDetails terminalArea,
        TransportType transportType,
        FillingType fillingType,
        String status,
        List<OrderContainerDetails> containers,
        List<OrderWaybillDetails> waybills,
        List<ShippingOrderRailwayCarriageDetails> railwayCarriages,
        List<RailwayCarriageQuantityDetails> railwayCarriageQuantities,
        List<ContainerQuantityDetails> containerQuantities,
        UUID contractId,
        String contractName,
        UUID serviceOrderId,
        UUID sourceReceivingOrderId,
        UUID routeId,
        UUID sourceShippingOrderId,
        List<ReturnReceivingOrder> returnOrders,
        LocalDateTime arrivalAt,
        String consignor,
        LocalDateTime departureAt,
        String consignee
) {
}
