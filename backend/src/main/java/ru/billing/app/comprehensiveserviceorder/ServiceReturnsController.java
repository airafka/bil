package ru.billing.app.comprehensiveserviceorder;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/comprehensive-service-orders/{id}/returns")
public class ServiceReturnsController {
    private final ReturnReceivingService service;
    public ServiceReturnsController(ReturnReceivingService service) { this.service = service; }
    @GetMapping("/available-containers")
    public List<ReturnReceivingService.ReturnCandidate> candidates(@PathVariable UUID id) { return service.candidates(id); }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReturnReceivingService.BulkReturnResult create(@PathVariable UUID id,
            @Valid @RequestBody ReturnReceivingService.CreateBulkReturnsRequest request) {
        return service.createForService(id,request);
    }
}
