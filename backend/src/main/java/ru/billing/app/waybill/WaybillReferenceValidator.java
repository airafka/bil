package ru.billing.app.waybill;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import ru.billing.app.error.ApiException;

@Component
public class WaybillReferenceValidator {

    private final JdbcTemplate jdbcTemplate;

    public WaybillReferenceValidator(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void validate(CreateWaybillRequest request) {
        if (request.receivingOrderId() != null) {
            validateReceivingOrder(request.receivingOrderId());
        }

        if (request.hazardClassId() != null) ensureAllExist("hazard_class", List.of(request.hazardClassId()), "HAZARD_CLASS_NOT_FOUND", "Класс опасности не найден");
        Set<UUID> carriageIds = new LinkedHashSet<>();
        Set<UUID> containerIds = new LinkedHashSet<>();
        request.railwayCarriages().forEach(carriage -> {
            carriageIds.add(carriage.railwayCarriageId());
            carriage.containers().forEach(container -> containerIds.add(container.containerId()));
        });
        Set<UUID> ownerIds = new LinkedHashSet<>(), sealTypeIds = new LinkedHashSet<>();
        request.railwayCarriages().forEach(carriage -> carriage.containers().forEach(c -> {
            if (c.ownerClientId() != null) ownerIds.add(c.ownerClientId());
            if (c.sealTypeId() != null) sealTypeIds.add(c.sealTypeId());
        }));
        ensureAllExist("client", ownerIds, "OWNER_CLIENT_NOT_FOUND", "Собственник КТК не найден");
        ensureAllExist("seal_type", sealTypeIds, "SEAL_TYPE_NOT_FOUND", "Тип ЗПУ не найден");
        Set<UUID> etsngCodeIds = new LinkedHashSet<>();
        if (request.etsngCodeId() != null) etsngCodeIds.add(request.etsngCodeId());
        request.railwayCarriages().forEach(carriage -> carriage.containers().forEach(container -> {
            if (container.etsngCodeId() != null) etsngCodeIds.add(container.etsngCodeId());
        }));

        ensureAllExist("railway_carriage", carriageIds, "RAILWAY_CARRIAGE_NOT_FOUND", "Вагон не найден");
        ensureAllExist("container", containerIds, "CONTAINER_NOT_FOUND", "КТК не найден");
        ensureAllExist("etsng_code", etsngCodeIds, "ETSNG_CODE_NOT_FOUND", "Код ЕТСНГ не найден");
    }

    private void validateReceivingOrder(UUID receivingOrderId) {
        List<String> scenarios = jdbcTemplate.query(
                """
                select a.code || '|' || o.transport_type
                  from receiving_order o
                  join terminal_area_catalog a on a.id = o.terminal_area_catalog_id
                 where o.id = ?
                """,
                (resultSet, rowNumber) -> resultSet.getString(1),
                receivingOrderId
        );
        if (scenarios.isEmpty()) {
            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "RECEIVING_ORDER_NOT_FOUND",
                    "Заявка на поставку не найдена: " + receivingOrderId
            );
        }
        if (!"CONTAINER|RAILWAY".equals(scenarios.getFirst())) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_RECEIVING_ORDER_FOR_WAYBILL",
                    "Накладную можно привязать только к железнодорожной заявке на контейнерной площадке"
            );
        }
    }

    private void ensureAllExist(String table, Collection<UUID> ids, String code, String message) {
        if (ids.isEmpty()) return;
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        List<UUID> found = jdbcTemplate.query(
                "select id from " + table + " where id in (" + placeholders + ")",
                (resultSet, rowNumber) -> resultSet.getObject("id", UUID.class),
                ids.toArray()
        );
        Set<UUID> missing = new LinkedHashSet<>(ids);
        missing.removeAll(found);
        if (!missing.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, code, message + ": " + missing.iterator().next());
        }
    }
}
