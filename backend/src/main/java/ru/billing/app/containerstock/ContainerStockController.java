package ru.billing.app.containerstock;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.order.PagedResponse;
@RestController
public class ContainerStockController {
    private final ContainerStockService service;
    public ContainerStockController(ContainerStockService service){this.service=service;}
    public record LookupRequest(@jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=1000)
        List<@jakarta.validation.constraints.NotNull UUID> containerIds) {}
    @PostMapping("/api/container-owners/lookup")
    public List<ContainerStockService.Lookup> lookup(@jakarta.validation.Valid @RequestBody LookupRequest request) {
        return service.lookup(request.containerIds());
    }
    @GetMapping({"/api/container-owners","/api/container-remains"})
    public PagedResponse<ContainerStockService.Owner> page(@RequestParam(defaultValue="")String query,
            @RequestParam(required=false)UUID clientId,@RequestParam(required=false)String status,
            @RequestParam(defaultValue="true")boolean inRemains,@RequestParam(defaultValue="0")int page,
            @RequestParam(defaultValue="20")int size,jakarta.servlet.http.HttpServletRequest request){
        return service.page(query.trim(),clientId,status==null||status.isBlank()?null:status,
            request.getRequestURI().equals("/api/container-remains")&&inRemains,page,size);
    }
    @GetMapping("/api/containers/{id}/owner-history")
    public List<ContainerStockService.History> history(@PathVariable UUID id,@RequestParam(defaultValue="false")boolean includeReservations){return service.history(id,includeReservations);}
}
