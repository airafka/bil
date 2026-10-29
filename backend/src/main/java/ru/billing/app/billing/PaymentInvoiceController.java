package ru.billing.app.billing;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.order.PagedResponse;

@RestController
@RequestMapping("/api/payment-invoices")
public class PaymentInvoiceController {
    private final PaymentInvoiceService service;
    public PaymentInvoiceController(PaymentInvoiceService service) { this.service = service; }

    @GetMapping("/available-charges")
    public PaymentInvoiceService.CandidatePage available(@RequestParam UUID clientId,
            @RequestParam UUID contractId, @RequestParam String period) {
        return service.candidates(clientId, contractId, period);
    }
    @GetMapping
    public PagedResponse<PaymentInvoiceService.Invoice> list(@RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size) { return service.list(page, size); }
    @GetMapping("/{id}")
    public PaymentInvoiceService.Details details(@PathVariable UUID id) { return service.details(id); }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentInvoiceService.Details create(@Valid @RequestBody PaymentInvoiceService.CreateRequest request) {
        return service.create(request);
    }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { service.delete(id); }
}
