package ru.billing.app.order;

import java.util.List;
import java.util.UUID;

public record ContainerQuantityDetails(
        UUID id,
        int quantity,
        ContainerType type,
        boolean empty,
        List<ContainerQuantityItemDetails> items
) {
}
