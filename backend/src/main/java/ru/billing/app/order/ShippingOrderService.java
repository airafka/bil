package ru.billing.app.order;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ru.billing.app.reference.ReferenceDataService;
import ru.billing.app.route.RouteService;

@Service
public class ShippingOrderService {

    private final OrderRequestValidator validator;
    private final ReferenceDataService referenceDataService;
    private final ShippingOrderStore store;
    private final RouteService routeService;

    public ShippingOrderService(
            OrderRequestValidator validator,
            ReferenceDataService referenceDataService,
            ShippingOrderStore store,
            RouteService routeService
    ) {
        this.validator = validator;
        this.referenceDataService = referenceDataService;
        this.store = store;
        this.routeService = routeService;
    }

    @Transactional
    public CreatedOrderResponse create(CreateOrderRequest request) {
        validator.validateShipping(request);
        if (request.transportType() == TransportType.RAILWAY) {
            referenceDataService.validateShippingRailwayReferences(request);
        } else {
            referenceDataService.validateReferences(request);
            if (validator.effectiveFillingType(request) == FillingType.ALL) {
                referenceDataService.validateVehicleShippingCapacity(request.containers());
            }
        }
        CreatedOrderResponse created = store.create(request);
        if (request.routeId() != null) routeService.assign(request.routeId(), java.util.List.of(created.id()));
        return created;
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderSummary> findPage(int page, int size) {
        return findPage(page, size, "", "");
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderSummary> findPage(int page, int size, String query, String status) {
        return store.findPage(page, size, query, status);
    }

    @Transactional(readOnly = true)
    public OrderDetails findById(UUID id) {
        return store.findById(id);
    }
}
