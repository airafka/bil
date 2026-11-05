package ru.billing.app.order;
import java.util.UUID;
import java.util.List;
public record ReturnReceivingOrder(UUID id, int code, String status, List<String> containerNames, java.time.LocalDateTime plannedAt, String consignor) {}
