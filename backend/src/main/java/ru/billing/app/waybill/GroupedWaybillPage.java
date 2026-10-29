package ru.billing.app.waybill;

import java.util.List;

public record GroupedWaybillPage(
        List<GroupedWaybillRow> content,
        long totalElements,
        int totalPages,
        int number,
        int size
) {
}
