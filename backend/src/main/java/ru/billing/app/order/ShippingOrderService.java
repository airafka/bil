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
    private final OrderContainerAdditionService additions;

    public ShippingOrderService(
            OrderRequestValidator validator,
            ReferenceDataService referenceDataService,
            ShippingOrderStore store,
            RouteService routeService, OrderContainerAdditionService additions
    ) {
        this.validator = validator;
        this.referenceDataService = referenceDataService;
        this.store = store;
        this.routeService = routeService;
        this.additions = additions;
    }

    @Transactional
    public CreatedOrderResponse create(CreateOrderRequest request) {
        if(request.defaultContainerOwnerId()!=null) throw new ru.billing.app.error.ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,"DEFAULT_OWNER_RECEIVING_ONLY","Собственник по умолчанию задаётся только в поставке");
        validator.validateShipping(request);
        if (request.transportType() == TransportType.RAILWAY) {
            referenceDataService.validateShippingRailwayReferences(request);
        } else {
            referenceDataService.validateReferences(request);
            if (validator.effectiveFillingType(request) == FillingType.ALL) {
                referenceDataService.validateVehicleShippingCapacity(request.containers());
            }
        }
        if (request.containers() != null) request.containers().forEach(c -> referenceDataService.validateContainerAttributes(null, c.sealTypeId(), c.hazardClassId()));
        if (request.railwayCarriages() != null) request.railwayCarriages().forEach(w -> {
            if (w.containers() != null) w.containers().forEach(c -> referenceDataService.validateContainerAttributes(null, c.sealTypeId(), c.hazardClassId()));
        });
        CreatedOrderResponse created = store.create(request);
        if (request.routeId() != null) routeService.assign(request.routeId(), java.util.List.of(created.id()));
        return created;
    }

    @Transactional
    public OrderDetails updateContainerAttributes(UUID id, UpdateOrderContainersRequest request) {
        request.containers().forEach(c -> referenceDataService.validateContainerAttributes(null, c.sealTypeId(), c.hazardClassId()));
        if(request.defaultContainerOwnerId()!=null) throw new ru.billing.app.error.ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,"DEFAULT_OWNER_RECEIVING_ONLY","Собственник вывоза определяется регистром");
        store.updateContainerAttributes(id, request);
        additions.add(false, id, request.additions());
        return store.findById(id);
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
