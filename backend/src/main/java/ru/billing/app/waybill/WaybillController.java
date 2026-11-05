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
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "20") int size) {
        return service.findAvailablePage(search, page, size);
    }

    @PostMapping("/grouped/page")
    public GroupedWaybillPage groupedPage(@RequestBody(required = false) GroupedWaybillRequest request) {
        return service.findGroupedPage(request);
    }
}
