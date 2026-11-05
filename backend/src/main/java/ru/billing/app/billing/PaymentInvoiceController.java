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
    @GetMapping("/{id}/tariffs/{chargeId}")
    public PaymentInvoiceService.AppliedTariff tariff(@PathVariable UUID id, @PathVariable UUID chargeId) {
        return service.appliedTariff(id, chargeId);
    }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentInvoiceService.Details create(@Valid @RequestBody PaymentInvoiceService.CreateRequest request) {
        return service.create(request);
    }
    @GetMapping("/{id}/available-charges")
    public PaymentInvoiceService.CandidatePage editableCharges(@PathVariable UUID id, @RequestParam UUID clientId,
            @RequestParam UUID contractId, @RequestParam String period) { return service.editCandidates(id, clientId, contractId, period); }
    @PutMapping("/{id}")
    public PaymentInvoiceService.Details update(@PathVariable UUID id, @Valid @RequestBody PaymentInvoiceService.UpdateRequest request) {
        return service.update(id, request);
    }
    @PostMapping("/{id}/paid")
    public PaymentInvoiceService.Details paid(@PathVariable UUID id, @Valid @RequestBody PaymentInvoiceService.PayRequest request) {
        return service.pay(id, request);
    }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { service.delete(id); }
}
