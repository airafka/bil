package ru.billing.app.comprehensiveserviceorder;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
public record UpdateServiceTransportMetadataRequest(@NotEmpty @Size(max=1000) List<@NotNull @Valid Item> orders) {
 public enum Kind { SHIPPING, RETURN_RECEIVING, INITIAL_RECEIVING }
 public record Item(@NotNull UUID id, @NotNull Kind kind, LocalDateTime plannedAt,
   @Size(max=255) String partyName, LocalDateTime originalPlannedAt, @Size(max=255) String originalPartyName) {}
}
