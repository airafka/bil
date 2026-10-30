package ru.billing.app.waybill;

import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import ru.billing.app.error.ApiException;

@Repository
public class WaybillStore {
    private final JdbcTemplate jdbc;
    public WaybillStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public CreatedWaybillResponse create(CreateWaybillRequest request) {
        if (request.hazardClassId() != null && request.etsngCodeId() == null) throw error("HAZARD_WITHOUT_CARGO", "Класс опасности указывается только для груза");
        UUID id = UUID.randomUUID();
        String number = jdbc.queryForObject("insert into waybill (id, receiving_order_id, departure_station, destination_station, payer) values (?, ?, ?, ?, ?) returning number",
                String.class, id, request.receivingOrderId(), request.departureStation(), request.destinationStation(), request.payer());
        boolean hasLoadedContainers = false;
        for (var carriage : request.railwayCarriages()) {
            UUID carriageId = UUID.randomUUID();
            jdbc.update("insert into waybill_railway_carriage (id, waybill_id, railway_carriage_id) values (?, ?, ?)", carriageId, id, carriage.railwayCarriageId());
            for (var container : carriage.containers()) {
                // Validate against the reference tare; store only gross in the waybill.
                BigDecimal tare = jdbc.queryForObject("select tare_weight from container where id = ? for share", BigDecimal.class, container.containerId());
                int comparison = container.grossWeight().compareTo(tare);
                if (comparison < 0) throw error("GROSS_BELOW_TARE", "Масса брутто КТК не может быть меньше массы тары из справочника");
                if (comparison > 0 && request.etsngCodeId() == null) throw error("ETSNG_CODE_REQUIRED", "Выберите груз для гружёного КТК");
                if (comparison == 0 && container.etsngCodeId() != null) throw error("CARGO_FOR_EMPTY_CONTAINER", "У порожнего КТК масса груза равна нулю; груз не указывается");
                if (comparison > 0) hasLoadedContainers = true;
                UUID containerRowId = UUID.randomUUID();
                jdbc.update("insert into waybill_container (id, waybill_railway_carriage_id, container_id, gross_weight, owner_client_id, seal_numbers, seal_type_id) values (?, ?, ?, ?, ?, ?, ?)",
                        containerRowId, carriageId, container.containerId(), container.grossWeight(), container.ownerClientId(), container.sealNumbers(), container.sealTypeId());
            }
        }
        if (request.etsngCodeId() != null) {
            if (!hasLoadedContainers) throw error("CARGO_FOR_EMPTY_CONTAINER", "В накладной с порожними КТК груз не указывается");
            jdbc.update("insert into waybill_product (id, waybill_id, etsng_code_id, hazard_class_id) values (?, ?, ?, ?)",
                    UUID.randomUUID(), id, request.etsngCodeId(), request.hazardClassId());
        }
        return new CreatedWaybillResponse(id, number);
    }
    private ApiException error(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
