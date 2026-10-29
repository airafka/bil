package ru.billing.app.waybill;

import java.util.UUID;

public record CreatedWaybillResponse(UUID id, String number) {
}
