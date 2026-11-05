package ru.billing.app.comprehensiveserviceorder;

import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record CreateComprehensiveServiceOrderRequest(
        @NotNull(message = "Клиент обязателен") UUID clientId,
        @NotNull(message = "Договор обязателен") UUID contractId,
        @NotEmpty(message = "Выберите хотя бы одну накладную") List<@NotNull UUID> waybillIds,
        UUID defaultContainerOwnerId,
        @NotNull(message = "Выберите услугу") UUID complexServiceId
) {
    public CreateComprehensiveServiceOrderRequest(UUID clientId,UUID contractId,List<UUID> waybillIds) {this(clientId,contractId,waybillIds,null,null);}
}
