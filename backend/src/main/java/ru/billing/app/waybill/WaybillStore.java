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
        UUID id = UUID.randomUUID();
        String number = jdbc.queryForObject("insert into waybill (id, receiving_order_id, departure_station, destination_station, payer) values (?, ?, ?, ?, ?) returning number",
                String.class, id, request.receivingOrderId(), request.departureStation(), request.destinationStation(), request.payer());
        for (var carriage : request.railwayCarriages()) {
            UUID carriageId = UUID.randomUUID();
            jdbc.update("insert into waybill_railway_carriage (id, waybill_id, railway_carriage_id) values (?, ?, ?)", carriageId, id, carriage.railwayCarriageId());
            for (var container : carriage.containers()) {
                // Validate against the reference tare; store only gross in the waybill.
                BigDecimal tare = jdbc.queryForObject("select tare_weight from container where id = ? for share", BigDecimal.class, container.containerId());
                int comparison = container.grossWeight().compareTo(tare);
                if (comparison < 0) throw error("GROSS_BELOW_TARE", "Масса брутто КТК не может быть меньше массы тары из справочника");
                if (comparison > 0 && container.etsngCodeId() == null) throw error("ETSNG_CODE_REQUIRED", "Выберите груз для гружёного КТК");
                if (comparison == 0 && container.etsngCodeId() != null) throw error("CARGO_FOR_EMPTY_CONTAINER", "У порожнего КТК масса груза равна нулю; груз не указывается");
                UUID containerRowId = UUID.randomUUID();
                jdbc.update("insert into waybill_container (id, waybill_railway_carriage_id, container_id, gross_weight) values (?, ?, ?, ?)",
                        containerRowId, carriageId, container.containerId(), container.grossWeight());
                if (container.etsngCodeId() != null) {
                    jdbc.update("insert into waybill_product (id, waybill_id, waybill_container_id, etsng_code_id) values (?, ?, ?, ?)",
                            UUID.randomUUID(), id, containerRowId, container.etsngCodeId());
                }
            }
        }
        return new CreatedWaybillResponse(id, number);
    }
    private ApiException error(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
