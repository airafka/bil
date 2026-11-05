package ru.billing.app.waybill;
import java.util.List;
public record AvailableWaybillPage(List<Row> content, long totalElements, int totalPages, int number, int size) {
    public record Row(String groupKey, int departureStation, int destinationStation, String payer, WaybillLink waybill) {}
}
