package ru.billing.app.waybill;
import java.math.BigDecimal;
import java.util.UUID;
import jakarta.validation.constraints.NotNull;

public record WaybillProductRequest(@NotNull UUID etsngCodeId, BigDecimal weight, UUID hazardClassId,
        @jakarta.validation.constraints.Size(max=255) String signDanger, UUID dangerProductId,
        @com.fasterxml.jackson.annotation.JsonProperty("danger_product") String dangerProduct) {
    public WaybillProductRequest(UUID etsngCodeId, BigDecimal weight, UUID hazardClassId) {
        this(etsngCodeId, weight, hazardClassId, null, null, null);
    }
    public WaybillProductRequest(UUID etsngCodeId, BigDecimal weight, UUID hazardClassId, String signDanger) {
        this(etsngCodeId, weight, hazardClassId, signDanger, null, null);
    }
    public WaybillProductRequest {
        signDanger = signDanger == null || signDanger.isBlank() ? null : signDanger.trim();
        dangerProduct = dangerProduct == null || dangerProduct.isBlank() ? null : dangerProduct.trim();
    }
}
