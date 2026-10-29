package ru.billing.app.serviceorder;

import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record CreateServiceOrderRequest(
        @NotNull(message = "Клиент обязателен") UUID clientId,
        @NotNull(message = "Договор обязателен") UUID contractId,
        @NotEmpty(message = "Выберите хотя бы одну накладную") List<@NotNull UUID> waybillIds
) {}
