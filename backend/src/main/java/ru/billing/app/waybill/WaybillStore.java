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
        UUID departure = reference("railway_station", "esr_code", request.departureStation().toString());
        UUID destination = reference("railway_station", "esr_code", request.destinationStation().toString());
        UUID payer = reference("payer", "name", request.payer());
        String number = jdbc.queryForObject("insert into waybill (id, receiving_order_id, departure_station_id, destination_station_id, payer_id, number) values (?, ?, ?, ?, ?, coalesce(?, nextval('waybill_number_seq')::text)) returning number",
                String.class, id, request.receivingOrderId(), departure, destination, payer, request.number());
        BigDecimal cargoWeight = BigDecimal.ZERO;
        for (var carriage : request.railwayCarriages()) {
            UUID carriageId = UUID.randomUUID();
            jdbc.update("insert into waybill_railway_carriage (id, waybill_id, railway_carriage_id) values (?, ?, ?)", carriageId, id, carriage.railwayCarriageId());
            for (var container : carriage.containers()) {
                BigDecimal tare = jdbc.queryForObject("select weight from container where id = ? for share", BigDecimal.class, container.containerId());
                BigDecimal net = container.netWeight() == null ? container.grossWeight().subtract(tare) : container.netWeight();
                if (net.signum() < 0 || net.compareTo(container.grossWeight()) > 0) throw error("INVALID_NET_WEIGHT", "Нетто КТК должно быть от нуля до брутто");
                cargoWeight = cargoWeight.add(net);
                UUID containerRowId = UUID.randomUUID();
                String owner = container.owner();
                jdbc.update("insert into waybill_container (id, waybill_railway_carriage_id, container_id, weight, net_weight, owner) values (?, ?, ?, ?, ?, ?)",
                        containerRowId, carriageId, container.containerId(), container.grossWeight(), net, owner);
                String zpuType = container.sealTypeId() == null ? null : jdbc.queryForObject("select code from seal_type where id = ?", String.class, container.sealTypeId());
                if (container.sealNumbers() != null) {
                    for (String zpu : container.sealNumbers().split("[,;\\r\\n]+")) {
                        if (!zpu.isBlank()) jdbc.update("insert into waybill_zpu(id, waybill_container_id, zpu, zpu_type) values (?, ?, ?, ?)",
                                UUID.randomUUID(), containerRowId, zpu.trim(), zpuType);
                    }
                } else if (zpuType != null) throw error("SEAL_NUMBERS_REQUIRED", "Укажите номер ЗПУ для выбранного типа");
            }
        }
        for (var product : request.products()) {
            UUID dangerProductId = new DangerProductResolver(jdbc).resolve(product);
            jdbc.update("insert into waybill_product (id, waybill_id, etsng_code_id, sign_danger, weight, danger_product_id) values (?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), id, product.etsngCodeId(), product.signDanger(), product.weight() == null ? cargoWeight : product.weight(), dangerProductId);
        }
        return new CreatedWaybillResponse(id, number);
    }
    private UUID reference(String table, String column, String value) {
        return jdbc.queryForObject("insert into " + table + "(id, " + column + ") values (?, ?) on conflict (" + column
                + ") do update set " + column + " = excluded." + column + " returning id", UUID.class, UUID.randomUUID(), value);
    }
    private ApiException error(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
