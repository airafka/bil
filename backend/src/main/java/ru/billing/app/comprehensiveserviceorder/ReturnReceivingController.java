package ru.billing.app.comprehensiveserviceorder;
import java.util.UUID;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
@RestController
@RequestMapping("/api/shipping-orders")
public class ReturnReceivingController {
    private final ReturnReceivingService service;
    public ReturnReceivingController(ReturnReceivingService service) { this.service=service; }
    @GetMapping("/return-contracts")
    public List<ReturnReceivingService.TariffContract> contracts() { return service.contracts(); }
    @PostMapping("/{id}/returns") @ResponseStatus(HttpStatus.CREATED)
    public ReturnReceivingService.ReturnResult create(@PathVariable UUID id,@Valid @RequestBody ReturnReceivingService.CreateReturnRequest request) { return service.create(id,request); }
}
