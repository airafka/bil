package ru.billing.app.order;

import java.util.UUID;

public record TerminalAreaDetails(UUID id, String code, String name) {
}
