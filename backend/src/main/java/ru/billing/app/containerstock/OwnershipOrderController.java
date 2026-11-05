package ru.billing.app.containerstock;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import ru.billing.app.order.PagedResponse;
import ru.billing.app.containerstock.OwnershipOrderService.Selection;
@RestController
@RequestMapping("/api/service-orders")
public class OwnershipOrderController {
    private final OwnershipOrderService service;
    public OwnershipOrderController(OwnershipOrderService service){this.service=service;}
    @GetMapping public PagedResponse<OwnershipOrderService.Header> page(@RequestParam(defaultValue="")String query,@RequestParam(defaultValue="")String status,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return service.page(query.trim(),status,page,size);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public OwnershipOrderService.Details create(@Valid @RequestBody OwnershipOrderService.Create request){return service.create(request);}
    @GetMapping("/containers/available") public PagedResponse<OwnershipOrderService.Link> availableForCreate(@RequestParam UUID clientId,@RequestParam(defaultValue="")String query,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return service.availableForCreate(clientId,query.trim(),page,size);}
    @GetMapping("/{id}") public OwnershipOrderService.Details details(@PathVariable UUID id){return service.details(id);}
    @PutMapping("/{id}") public OwnershipOrderService.Details update(@PathVariable UUID id,@Valid @RequestBody OwnershipOrderService.Update request){return service.update(id,request);}
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable UUID id){service.delete(id);}
    @PostMapping("/{id}/accept") public OwnershipOrderService.Details accept(@PathVariable UUID id){return service.accept(id);}
    @GetMapping("/{id}/containers/available") public PagedResponse<OwnershipOrderService.Link> available(@PathVariable UUID id,@RequestParam(defaultValue="")String query,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return service.available(id,query.trim(),page,size);}
    @PutMapping("/{id}/containers") public OwnershipOrderService.Details select(@PathVariable UUID id,@Valid @RequestBody @NotNull List<@NotNull @Valid Selection> selected){return service.select(id,selected);}
}
