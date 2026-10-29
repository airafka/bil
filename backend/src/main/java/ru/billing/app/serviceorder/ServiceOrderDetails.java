package ru.billing.app.serviceorder;

import java.util.List;
import ru.billing.app.order.OrderDetails;

public record ServiceOrderDetails(ServiceOrderSummary order, OrderDetails receivingOrder,
        List<ServiceShippingOrder> shippingOrders, List<ServiceSelectableContainer> selectableContainers,
        List<ru.billing.app.order.ReturnReceivingOrder> returnOrders, ServiceProgress progress) {}
