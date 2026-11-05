package ru.billing.app.reference;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
@RestController
@RequestMapping("/api/transport-catalogs/{kind}")
public class TransportCatalogController {
 private final TransportCatalogService service;
 public TransportCatalogController(TransportCatalogService service){this.service=service;}
 @GetMapping public List<TransportCatalogService.Entry> list(@PathVariable String kind,@RequestParam(defaultValue="false") boolean activeOnly){return service.list(kind,activeOnly);}
 @GetMapping("/{id}") public TransportCatalogService.Entry get(@PathVariable String kind,@PathVariable UUID id){return service.get(kind,id);}
 @PostMapping @ResponseStatus(HttpStatus.CREATED) public TransportCatalogService.Entry create(@PathVariable String kind,@Valid @RequestBody TransportCatalogService.Input input){return service.save(kind,null,input);}
 @PutMapping("/{id}") public TransportCatalogService.Entry update(@PathVariable String kind,@PathVariable UUID id,@Valid @RequestBody TransportCatalogService.Input input){return service.save(kind,id,input);}
 @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable String kind,@PathVariable UUID id){service.delete(kind,id);}
}
