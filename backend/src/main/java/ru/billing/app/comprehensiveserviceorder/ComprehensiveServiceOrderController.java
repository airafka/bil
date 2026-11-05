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
    private final ServiceTransportMetadataService metadata;
    public ComprehensiveServiceOrderController(ComprehensiveServiceOrderService service, ServiceTransportMetadataService metadata) { this.service = service; this.metadata=metadata; }

    @PatchMapping("/{id}/transport-metadata")
    public ComprehensiveServiceOrderDetails updateMetadata(@PathVariable UUID id,@Valid @RequestBody UpdateServiceTransportMetadataRequest request){return metadata.update(id,request);}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ComprehensiveServiceOrderDetails create(@Valid @RequestBody CreateComprehensiveServiceOrderRequest request) { return service.create(request); }

    @PostMapping("/{id}/shipping-orders")
    @ResponseStatus(HttpStatus.CREATED)
    public ComprehensiveServiceOrderDetails createShippingOrder(@PathVariable UUID id,
            @Valid @RequestBody CreateServiceShippingRequest request) {
        return service.createShippingForTwentyFootContainers(id, request.containerIds());
    }

    @GetMapping("/available-services")
    public java.util.List<ComprehensiveServiceOrderService.AvailableService> availableServices() { return service.availableServices(); }

    @GetMapping
    public PagedResponse<ComprehensiveServiceOrderSummary> findPage(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String status) { return service.findPage(page, size, query.trim(), status); }

    @GetMapping("/{id}")
    public ComprehensiveServiceOrderDetails findById(@PathVariable UUID id) { return service.findById(id); }
}
