package ru.billing.app.comprehensiveserviceorder;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.order.PagedResponse;

@RestController
@RequestMapping("/api/comprehensive-service-orders")
public class ComprehensiveServiceOrderController {
    private final ComprehensiveServiceOrderService service;
    public ComprehensiveServiceOrderController(ComprehensiveServiceOrderService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ComprehensiveServiceOrderDetails create(@Valid @RequestBody CreateComprehensiveServiceOrderRequest request) { return service.create(request); }

    @PostMapping("/{id}/shipping-orders")
    @ResponseStatus(HttpStatus.CREATED)
    public ComprehensiveServiceOrderDetails createShippingOrder(@PathVariable UUID id,
            @Valid @RequestBody CreateServiceShippingRequest request) {
        return service.createShippingForTwentyFootContainers(id, request.containerIds());
    }

    @GetMapping
    public PagedResponse<ComprehensiveServiceOrderSummary> findPage(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String status) { return service.findPage(page, size, query.trim(), status); }

    @GetMapping("/{id}")
    public ComprehensiveServiceOrderDetails findById(@PathVariable UUID id) { return service.findById(id); }
}
