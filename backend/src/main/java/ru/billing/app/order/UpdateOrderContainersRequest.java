package ru.billing.app.order;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record UpdateOrderContainersRequest(@NotNull List<@NotNull @Valid Attributes> containers, UUID defaultContainerOwnerId, @Size(max=1000) List<@NotNull @Valid Addition> additions) {
    public UpdateOrderContainersRequest { additions = additions == null ? List.of() : List.copyOf(additions); }
    public UpdateOrderContainersRequest(List<Attributes> containers, UUID defaultContainerOwnerId) { this(containers,defaultContainerOwnerId,List.of()); }
    public UpdateOrderContainersRequest(List<Attributes> containers) { this(containers,null,List.of()); }
    public record Addition(@NotNull @Valid OrderContainerRequest container, UUID railwayCarriageId) {}
    @AssertTrue(message="Укажите реквизиты КТК или собственника по умолчанию")
    public boolean isChangePresent() { return containers != null && (!containers.isEmpty() || defaultContainerOwnerId != null || !additions.isEmpty()); }
    public record Attributes(@NotNull UUID containerId, UUID ownerClientId,
            @Size(max = 1000, message = "Номера ЗПУ: не более 1000 символов") String sealNumbers,
            UUID sealTypeId, UUID hazardClassId) {
        public Attributes {
            sealNumbers = sealNumbers == null || sealNumbers.isBlank() ? null : sealNumbers.trim();
        }
    }
}
