package ru.billing.app.comprehensiveserviceorder;

import java.util.List;
import ru.billing.app.order.OrderDetails;

public record ComprehensiveServiceOrderDetails(ComprehensiveServiceOrderSummary order, OrderDetails receivingOrder,
        List<ServiceShippingOrder> shippingOrders, List<ServiceSelectableContainer> selectableContainers,
        List<ru.billing.app.order.ReturnReceivingOrder> returnOrders, ServiceProgress progress) {}
