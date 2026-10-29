package ru.billing.app.complexservice;

import java.util.List;

public record ComplexServiceDetails(ComplexServiceSummary service, List<ComplexServiceTariff> tariffs) {}
