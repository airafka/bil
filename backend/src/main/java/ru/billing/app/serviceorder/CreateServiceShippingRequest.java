package ru.billing.app.serviceorder;

import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record CreateServiceShippingRequest(@NotEmpty List<@NotNull UUID> containerIds) {}
