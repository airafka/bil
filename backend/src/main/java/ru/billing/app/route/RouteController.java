package ru.billing.app.route;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.order.TransportType;

@RestController
@RequestMapping("/api/routes")
public class RouteController {
    private final RouteService service;
    public RouteController(RouteService service) { this.service = service; }

    @GetMapping
    public List<RouteSummary> findAll() { return service.findAll(); }

    @GetMapping("/available-orders")
    public List<RouteOrderOption> available(@RequestParam RouteType routeType,
            @RequestParam TransportType transportType, @RequestParam UUID terminalAreaId) {
        return service.available(routeType, transportType, terminalAreaId);
    }

    @GetMapping("/{id}")
    public RouteDetails findById(@PathVariable UUID id) { return service.findById(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RouteDetails create(@Valid @RequestBody CreateRouteRequest request) { return service.create(request); }

    @PostMapping("/{id}/orders")
    public RouteDetails assign(@PathVariable UUID id, @Valid @RequestBody AssignRouteOrdersRequest request) {
        return service.assign(id, request.orderIds());
    }
}
