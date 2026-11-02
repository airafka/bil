package ru.billing.app.reference;
import java.util.UUID;
public record DangerProductOption(UUID id, Integer identifier, String name, UUID dangerClassId, String dangerClassName, String dangerClassCode) {}
