package ru.billing.app.order;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/receiving-orders")
public class ReceivingOrderController {

    private final ReceivingOrderService service;

    public ReceivingOrderController(ReceivingOrderService service) {
        this.service = service;
    }

    @GetMapping
    public PagedResponse<OrderSummary> findAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String status
    ) {
        return service.findPage(page, size, query.trim(), status);
    }

    @GetMapping("/{id}")
    public OrderDetails findById(@PathVariable UUID id) {
        return service.findById(id);
    }

    @org.springframework.web.bind.annotation.PatchMapping("/{id}/containers")
    public OrderDetails updateContainers(@PathVariable UUID id, @Valid @RequestBody UpdateOrderContainersRequest request) {
        return service.updateContainerAttributes(id, request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedOrderResponse create(@Valid @RequestBody CreateOrderRequest request) {
        return service.create(request);
    }
}
