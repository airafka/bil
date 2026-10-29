package ru.billing.app.complexservice;

import java.math.BigDecimal;
import java.util.UUID;

public record ComplexServiceSummary(UUID id, String name, BigDecimal priceWithoutVat,
        BigDecimal priceWithVat, int tariffCount) {}
