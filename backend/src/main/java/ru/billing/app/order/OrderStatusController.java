package ru.billing.app.order;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
public class OrderStatusController {
    private final OrderStatusService service;
    public OrderStatusController(OrderStatusService service) { this.service = service; }
    @PatchMapping("/api/{resource:receiving-orders|shipping-orders|service-orders}/{id}/status")
    public CreatedOrderResponse change(@PathVariable String resource, @PathVariable UUID id,
            @Valid @RequestBody OrderStatusService.ChangeStatusRequest request) {
        return service.change(resource, id, request);
    }
}
