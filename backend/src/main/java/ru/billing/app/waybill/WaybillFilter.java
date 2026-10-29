package ru.billing.app.waybill;

public record WaybillFilter(Integer departureStation, Integer destinationStation, String payer) {
}
