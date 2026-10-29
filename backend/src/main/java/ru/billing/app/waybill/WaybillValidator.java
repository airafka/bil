package ru.billing.app.waybill;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import ru.billing.app.error.ApiException;

@Component
public class WaybillValidator {
    public CreateWaybillRequest normalizeAndValidate(CreateWaybillRequest request) {
        String payer = request.payer() == null ? "" : request.payer().trim();
        if (payer.isEmpty()) throw error("PAYER_REQUIRED", "Плательщик обязателен");
        if (request.departureStation() == null) throw error("DEPARTURE_STATION_REQUIRED", "Станция отправления обязательна");
        if (request.destinationStation() == null) throw error("DESTINATION_STATION_REQUIRED", "Станция назначения обязательна");
        List<WaybillRailwayCarriageRequest> carriages = request.railwayCarriages() == null ? List.of() : request.railwayCarriages();
        var seenCarriages = new HashSet<UUID>();
        var seenContainers = new HashSet<UUID>();
        for (var carriage : carriages) {
            if (carriage == null || carriage.railwayCarriageId() == null) throw error("RAILWAY_CARRIAGE_REQUIRED", "Выберите вагон");
            if (!seenCarriages.add(carriage.railwayCarriageId())) throw error("DUPLICATE_RAILWAY_CARRIAGE", "Вагон не может повторяться в накладной");
            for (var container : carriage.containers() == null ? List.<WaybillContainerRequest>of() : carriage.containers()) {
                if (container == null || container.containerId() == null) throw error("CONTAINER_REQUIRED", "Выберите КТК");
                if (!seenContainers.add(container.containerId())) throw error("DUPLICATE_CONTAINER", "КТК не может повторяться в накладной");
                var gross = container.grossWeight();
                if (gross == null || gross.signum() <= 0) throw error("GROSS_WEIGHT_REQUIRED", "Укажите положительную массу брутто КТК");
                if (gross.scale() > 3 || gross.precision() - gross.scale() > 13) throw error("INVALID_WEIGHT_SCALE", "Масса брутто должна содержать не более трёх знаков после запятой и 13 цифр до запятой");
            }
        }
        var cargos = new HashSet<UUID>();
        for (var carriage : carriages) for (var container : carriage.containers() == null ? List.<WaybillContainerRequest>of() : carriage.containers()) {
            if (container.etsngCodeId() != null) cargos.add(container.etsngCodeId());
        }
        if (cargos.size() > 1) throw error("SINGLE_WAYBILL_CARGO", "В накладной может быть только один груз для всех КТК");
        return new CreateWaybillRequest(request.receivingOrderId(), request.departureStation(), request.destinationStation(), payer,
                carriages.stream().map(c -> new WaybillRailwayCarriageRequest(c.railwayCarriageId(),
                        c.containers() == null ? List.of() : List.copyOf(c.containers()))).toList());
    }
    private ApiException error(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
