package ru.billing.app.complexservice;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/complex-services")
public class ComplexServiceCatalogController {
    private final ComplexServiceCatalogService service;

    public ComplexServiceCatalogController(ComplexServiceCatalogService service) { this.service = service; }

    @GetMapping
    public List<ComplexServiceSummary> findAll() { return service.findAll(); }

    @GetMapping("/{id}")
    public ComplexServiceDetails findById(@PathVariable UUID id) { return service.findById(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ComplexServiceDetails create(@Valid @RequestBody ComplexServiceRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public ComplexServiceDetails update(@PathVariable UUID id, @Valid @RequestBody ComplexServiceRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { service.delete(id); }

    @PutMapping("/{id}/tariffs")
    public ComplexServiceDetails saveTariff(@PathVariable UUID id,
            @Valid @RequestBody ComplexServiceTariffRequest request) {
        return service.saveTariff(id, request);
    }

    @DeleteMapping("/{id}/tariffs/{contractId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTariff(@PathVariable UUID id, @PathVariable UUID contractId) {
        service.deleteTariff(id, contractId);
    }
}
