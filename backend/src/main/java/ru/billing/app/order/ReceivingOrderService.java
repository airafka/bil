package ru.billing.app.order;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ru.billing.app.reference.ReferenceDataService;
import ru.billing.app.route.RouteService;

@Service
public class ReceivingOrderService {

    private final OrderRequestValidator validator;
    private final ReferenceDataService referenceDataService;
    private final ReceivingOrderStore store;
    private final RouteService routeService;

    public ReceivingOrderService(
            OrderRequestValidator validator,
            ReferenceDataService referenceDataService,
            ReceivingOrderStore store,
            RouteService routeService
    ) {
        this.validator = validator;
        this.referenceDataService = referenceDataService;
        this.store = store;
        this.routeService = routeService;
    }

    @Transactional
    public CreatedOrderResponse create(CreateOrderRequest request) {
        validator.validate(request);
        if (request.transportType() == TransportType.RAILWAY) {
            referenceDataService.validateCommonReferences(request);
            CreatedOrderResponse created = store.createRailway(request);
            if (request.routeId() != null) routeService.assign(request.routeId(), java.util.List.of(created.id()));
            return created;
        }
        referenceDataService.validateReferences(request);
        CreatedOrderResponse created = store.createVehicle(request);
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
