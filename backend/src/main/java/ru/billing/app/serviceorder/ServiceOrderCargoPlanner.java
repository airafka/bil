package ru.billing.app.serviceorder;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.CargoRequest;
import ru.billing.app.order.OrderContainerRequest;

final class ServiceOrderCargoPlanner {
    private ServiceOrderCargoPlanner() {}

    record SourceContainer(UUID containerId, UUID etsngCodeId, BigDecimal grossWeight, BigDecimal tareWeight,
            UUID ownerClientId, String sealNumbers, UUID sealTypeId, UUID hazardClassId) {
        SourceContainer(UUID containerId, UUID etsngCodeId, BigDecimal grossWeight, BigDecimal tareWeight, UUID ownerClientId, String sealNumbers, UUID sealTypeId) {
            this(containerId, etsngCodeId, grossWeight, tareWeight, ownerClientId, sealNumbers, sealTypeId, null);
        }
        SourceContainer(UUID containerId, UUID etsngCodeId, BigDecimal grossWeight, BigDecimal tareWeight) {
            this(containerId, etsngCodeId, grossWeight, tareWeight, null, null, null, null);
        }
    }

    static List<OrderContainerRequest> plan(List<SourceContainer> rows) {
        var containers = new LinkedHashMap<UUID, SourceContainer>();
        for (var row : rows) {
            var previous = containers.putIfAbsent(row.containerId(), row);
            if (previous != null && (previous.grossWeight().compareTo(row.grossWeight()) != 0
                    || !Objects.equals(previous.etsngCodeId(), row.etsngCodeId()))) {
                throw error("CONFLICTING_CONTAINER_CARGO", "У одного КТК в выбранных накладных различаются груз или масса брутто");
            }
            if (previous != null && (!Objects.equals(previous.ownerClientId(), row.ownerClientId())
                    || !Objects.equals(previous.sealNumbers(), row.sealNumbers())
                    || !Objects.equals(previous.hazardClassId(), row.hazardClassId())
                    || !Objects.equals(previous.sealTypeId(), row.sealTypeId()))) {
                throw error("CONFLICTING_CONTAINER_ATTRIBUTES", "У одного КТК в выбранных накладных различаются собственник или реквизиты ЗПУ");
            }
        }
        return containers.values().stream().map(row -> {
            BigDecimal weight = row.grossWeight().subtract(row.tareWeight());
            if (weight.signum() < 0) throw error("GROSS_BELOW_TARE", "Масса брутто КТК меньше текущей тары из справочника");
            boolean empty = weight.signum() == 0;
            if (!empty && row.etsngCodeId() == null) throw error("CONTAINER_CARGO_REQUIRED", "Для гружёного КТК в поставке не указан груз по ЕТСНГ");
            return new OrderContainerRequest(row.containerId(), empty,
                    empty ? null : new CargoRequest(row.etsngCodeId(), weight), row.ownerClientId(), row.sealNumbers(), row.sealTypeId(), empty ? null : row.hazardClassId());
        }).toList();
    }

    private static ApiException error(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }
}
