package ru.billing.app.order;

import java.util.List;
import java.util.UUID;

public record OrderWaybillDetails(
        UUID id,
        String number,
        int departureStation,
        int destinationStation,
        String payer,
        List<OrderWaybillCarriageDetails> railwayCarriages,
        List<OrderWaybillProductDetails> products
) {
}
