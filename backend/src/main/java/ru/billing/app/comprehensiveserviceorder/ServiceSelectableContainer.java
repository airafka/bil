package ru.billing.app.comprehensiveserviceorder;

import java.util.UUID;

public record ServiceSelectableContainer(UUID containerId, String containerName, String type) {}
