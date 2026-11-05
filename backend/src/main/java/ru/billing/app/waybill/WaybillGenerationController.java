package ru.billing.app.waybill;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
@RestController
@RequestMapping("/api/waybills")
public class WaybillGenerationController {
    private final WaybillGenerationService generator;
    public WaybillGenerationController(WaybillGenerationService generator){this.generator=generator;}
    @PostMapping("/generate") @ResponseStatus(HttpStatus.CREATED)
    public CreatedWaybillResponse generate(@Valid @RequestBody GenerateWaybillRequest request){return generator.generate(request);}
}
