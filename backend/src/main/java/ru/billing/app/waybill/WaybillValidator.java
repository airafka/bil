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
        if (request.hazardClassId() != null) throw error("WAYBILL_DANGER_PRODUCT_REQUIRED", "Выберите опасный груз вместо прямого класса опасности накладной");
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
                if (container.ownerClientId() != null) throw error("WAYBILL_OWNER_TEXT_REQUIRED", "Собственник накладной передаётся текстом в поле owner");
                var gross = container.grossWeight();
                if (gross == null || gross.signum() <= 0) throw error("GROSS_WEIGHT_REQUIRED", "Укажите положительную массу брутто КТК");
                if (gross.scale() > 3 || gross.precision() - gross.scale() > 13) throw error("INVALID_WEIGHT_SCALE", "Масса брутто должна содержать не более трёх знаков после запятой и 13 цифр до запятой");
                if (container.netWeight() != null && (container.netWeight().signum() < 0 || container.netWeight().compareTo(gross) > 0 || container.netWeight().scale() > 3)) throw error("INVALID_NET_WEIGHT", "Нетто КТК должно быть от нуля до брутто, с точностью до 0,001 кг");
            }
        }
        var legacyCodes = new HashSet<UUID>();
        if (request.etsngCodeId() != null) legacyCodes.add(request.etsngCodeId());
        for (var carriage : carriages) for (var container : carriage.containers() == null ? List.<WaybillContainerRequest>of() : carriage.containers()) {
            if (container.etsngCodeId() != null) legacyCodes.add(container.etsngCodeId());
        }
        if (legacyCodes.size() > 1) throw error("SINGLE_WAYBILL_CARGO", "Для нескольких грузов используйте список products");
        var products = request.products() == null ? new java.util.ArrayList<WaybillProductRequest>() : new java.util.ArrayList<>(request.products());
        if (products.isEmpty() && !legacyCodes.isEmpty()) products.add(new WaybillProductRequest(legacyCodes.iterator().next(), null, request.hazardClassId()));
        if (!legacyCodes.isEmpty() && request.products() != null && (products.size() != 1 || !products.getFirst().etsngCodeId().equals(legacyCodes.iterator().next()))) throw error("CONFLICTING_WAYBILL_PRODUCTS", "Груз в старом формате не совпадает со списком products");
        if (products.isEmpty()) throw error("WAYBILL_PRODUCTS_REQUIRED", "Накладная должна содержать хотя бы один груз, в том числе при порожних КТК");
        if (products.size() > 1 && seenContainers.size() != 1) throw error("MULTIPLE_PRODUCTS_SINGLE_CONTAINER", "Для нескольких грузов в накладной должен быть ровно один КТК");
        for (var product : products) {
            if (product == null || product.etsngCodeId() == null) throw error("ETSNG_CODE_REQUIRED", "Выберите груз по ЕТСНГ");
            if (products.size() > 1 && product.weight() == null) throw error("PRODUCT_WEIGHT_REQUIRED", "Укажите массу каждого груза");
            if (product.weight() != null && (product.weight().signum() < 0 || product.weight().scale() > 3 || product.weight().precision() - product.weight().scale() > 13)) throw error("INVALID_PRODUCT_WEIGHT", "Масса груза должна быть неотрицательной, с точностью до 0,001 кг");
        }
        return new CreateWaybillRequest(request.receivingOrderId(), request.departureStation(), request.destinationStation(), payer, null, null,
                carriages.stream().map(c -> new WaybillRailwayCarriageRequest(c.railwayCarriageId(),
                        c.containers() == null ? List.of() : List.copyOf(c.containers()))).toList(), List.copyOf(products),
                request.number() == null || request.number().isBlank() ? null : request.number().trim());
    }
    private ApiException error(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
