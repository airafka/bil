package ru.billing.app.serviceorder;

import java.util.UUID;

public record ServiceSelectableContainer(UUID containerId, String containerName, String type) {}
