package ru.billing.app.waybill;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/waybills")
public class WaybillController {

    private final WaybillService service;

    public WaybillController(WaybillService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedWaybillResponse create(@Valid @RequestBody CreateWaybillRequest request) {
        return service.create(request);
    }

    @org.springframework.web.bind.annotation.GetMapping("/available")
    public AvailableWaybillPage available(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "") String search,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "20") int size,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Integer departureStation,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Integer destinationStation,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String payer) {
        return service.findAvailablePage(search, page, size, new WaybillFilter(departureStation, destinationStation, payer));
    }

    @org.springframework.web.bind.annotation.GetMapping("/available/options")
    public java.util.List<WaybillSelectionOption> availableOptions() {
        return service.findAvailableOptions();
    }

    @PostMapping("/grouped/page")
    public GroupedWaybillPage groupedPage(@RequestBody(required = false) GroupedWaybillRequest request) {
        return service.findGroupedPage(request);
    }
}
