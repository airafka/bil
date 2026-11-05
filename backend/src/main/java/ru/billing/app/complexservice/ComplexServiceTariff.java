package ru.billing.app.complexservice;

import java.math.BigDecimal;
import java.util.UUID;

public record ComplexServiceTariff(UUID id, UUID clientId, String clientName,
        UUID contractId, String contractName, BigDecimal coefficient, boolean active,
        BigDecimal priceWithoutVat, BigDecimal priceWithVat) {}
