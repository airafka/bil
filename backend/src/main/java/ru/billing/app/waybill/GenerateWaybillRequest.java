package ru.billing.app.waybill;
import jakarta.validation.constraints.*;
public record GenerateWaybillRequest(@NotNull @Min(0) @Max(200) Integer standard20,
        @NotNull @Min(0) @Max(200) Integer standard40) {}
