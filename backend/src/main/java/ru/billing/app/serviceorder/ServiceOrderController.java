package ru.billing.app.serviceorder;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.order.PagedResponse;

@RestController
@RequestMapping("/api/service-orders")
public class ServiceOrderController {
    private final ServiceOrderService service;
    public ServiceOrderController(ServiceOrderService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceOrderDetails create(@Valid @RequestBody CreateServiceOrderRequest request) { return service.create(request); }

    @PostMapping("/{id}/shipping-orders")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceOrderDetails createShippingOrder(@PathVariable UUID id,
            @Valid @RequestBody CreateServiceShippingRequest request) {
        return service.createShippingForTwentyFootContainers(id, request.containerIds());
    }

    @GetMapping
    public PagedResponse<ServiceOrderSummary> findPage(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String status) { return service.findPage(page, size, query.trim(), status); }

    @GetMapping("/{id}")
    public ServiceOrderDetails findById(@PathVariable UUID id) { return service.findById(id); }
}
