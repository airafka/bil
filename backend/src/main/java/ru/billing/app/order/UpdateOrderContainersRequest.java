package ru.billing.app.order;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record UpdateOrderContainersRequest(@NotEmpty List<@NotNull @Valid Attributes> containers) {
    public record Attributes(@NotNull UUID containerId, UUID ownerClientId,
            @Size(max = 1000, message = "Номера ЗПУ: не более 1000 символов") String sealNumbers,
            UUID sealTypeId, UUID hazardClassId) {
        public Attributes {
            sealNumbers = sealNumbers == null || sealNumbers.isBlank() ? null : sealNumbers.trim();
        }
    }
}
