package ru.billing.app.reference;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/references")
public class ReferenceDataController {

    private final ReferenceDataService referenceDataService;

    public ReferenceDataController(ReferenceDataService referenceDataService) {
        this.referenceDataService = referenceDataService;
    }

    @GetMapping("/seal-types")
    public List<ReferenceOption> sealTypes(@RequestParam(required = false) String q, @RequestParam(required = false) Integer limit) {
        return referenceDataService.findSealTypes(q, limit);
    }

    @GetMapping("/hazard-classes")
    public List<ReferenceOption> hazardClasses(@RequestParam(required = false) String q, @RequestParam(required = false) Integer limit) {
        return referenceDataService.findHazardClasses(q, limit);
    }

    @GetMapping("/clients")
    public List<ReferenceOption> clients(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit
    ) {
        return referenceDataService.findClients(q, limit);
    }

    @GetMapping("/contracts")
    public List<ContractOption> contracts(@RequestParam(required = false) java.util.UUID clientId) {
        return referenceDataService.findContracts(clientId);
    }

    @GetMapping("/containers")
    public List<ContainerReferenceOption> containers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit
    ) {
        return referenceDataService.findContainers(q, limit);
    }

    @org.springframework.web.bind.annotation.PatchMapping("/containers/{id}/tare-weight")
    public ContainerReferenceOption updateTare(@org.springframework.web.bind.annotation.PathVariable java.util.UUID id,
            @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody UpdateContainerTareRequest request) {
        return referenceDataService.updateContainerTare(id, request.tareWeight());
    }

    @org.springframework.web.bind.annotation.PatchMapping("/containers/{id}/attributes")
    public ContainerReferenceOption updateContainerAttributes(@org.springframework.web.bind.annotation.PathVariable java.util.UUID id,
            @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody UpdateContainerAttributesRequest request) {
        return referenceDataService.updateContainerAttributes(id, request);
    }

    @GetMapping("/etsng-codes")
    public List<ReferenceOption> etsngCodes(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit
    ) {
        return referenceDataService.findEtsngCodes(q, limit);
    }

    @GetMapping("/railway-carriages")
    public List<RailwayCarriageReferenceOption> railwayCarriages(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit
    ) {
        return referenceDataService.findRailwayCarriages(q, limit);
    }

    @GetMapping("/railway-carriages/page")
    public ru.billing.app.order.PagedResponse<RailwayCarriageReferenceOption> railwayCarriagePage(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return referenceDataService.findRailwayCarriagePage(page, size);
    }

    @GetMapping("/railway-carriage-models")
    public List<ReferenceOption> railwayCarriageModels(@RequestParam(required = false) String q, @RequestParam(required = false) Integer limit) {
        return referenceDataService.findRailwayCarriageModels(q, limit);
    }

    @GetMapping("/railway-carriage-kinds")
    public List<ReferenceOption> railwayCarriageKinds() { return referenceDataService.findRailwayCarriageKinds(); }

    @org.springframework.web.bind.annotation.PatchMapping("/railway-carriages/{id}")
    public RailwayCarriageReferenceOption updateRailwayCarriage(@org.springframework.web.bind.annotation.PathVariable java.util.UUID id,
            @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody UpdateRailwayCarriageRequest request) {
        return referenceDataService.updateRailwayCarriage(id, request);
    }

    @GetMapping("/railway-carriage-types")
    public List<ReferenceOption> railwayCarriageTypes(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit
    ) {
        return referenceDataService.findRailwayCarriageTypes(q, limit);
    }

    @GetMapping("/terminal-areas")
    public List<TerminalAreaOption> terminalAreas() {
        return referenceDataService.findTerminalAreas();
    }

    @GetMapping("/transport-types")
    public List<TransportTypeOption> transportTypes() {
        return referenceDataService.findTransportTypes();
    }
}
