package ru.billing.app.order;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import ru.billing.app.error.ApiException;

@Repository
public class ReceivingOrderStore {

    private final JdbcTemplate jdbcTemplate;

    public ReceivingOrderStore(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public CreatedOrderResponse createVehicle(CreateOrderRequest request) {
        UUID orderId = UUID.randomUUID();
        Integer code = insertHeader(orderId, request);

        for (OrderContainerRequest container : request.containers()) {
            UUID orderContainerId = UUID.randomUUID();
            jdbcTemplate.update(
                    "insert into receiving_order_container "
                            + "(id, receiving_order_id, container_id, empty) values (?, ?, ?, ?)",
                    orderContainerId,
                    orderId,
                    container.containerId(),
                    container.empty()
            );
            insertCargo(orderContainerId, container.cargo());
        }

        return new CreatedOrderResponse(orderId, code, "DRAFT");
    }

    public CreatedOrderResponse createRailway(CreateOrderRequest request) {
        List<LockedWaybill> lockedWaybills = lockWaybills(request.waybillIds());
        Map<UUID, LockedWaybill> byId = new LinkedHashMap<>();
        lockedWaybills.forEach(waybill -> byId.put(waybill.id(), waybill));

        for (UUID waybillId : request.waybillIds()) {
            LockedWaybill waybill = byId.get(waybillId);
            if (waybill == null) {
                throw new ApiException(HttpStatus.NOT_FOUND, "WAYBILL_NOT_FOUND", "Накладная не найдена: " + waybillId);
            }
            if (waybill.receivingOrderId() != null) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "WAYBILL_ALREADY_LINKED",
                        "Накладная уже включена в другую заявку: " + waybill.number()
                );
            }
        }

        LockedWaybill first = byId.get(request.waybillIds().getFirst());
        boolean oneGroup = lockedWaybills.stream().allMatch(waybill ->
                waybill.departureStation() == first.departureStation()
                        && waybill.destinationStation() == first.destinationStation()
                        && waybill.payer().equals(first.payer())
        );
        if (!oneGroup) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "WAYBILLS_FROM_DIFFERENT_GROUPS",
                    "Выбранные накладные относятся к разным маршрутам или плательщикам"
            );
        }

        UUID orderId = UUID.randomUUID();
        Integer code = insertHeader(orderId, request);
        String placeholders = String.join(",", Collections.nCopies(request.waybillIds().size(), "?"));
        List<Object> parameters = new ArrayList<>();
        parameters.add(orderId);
        parameters.addAll(request.waybillIds());
        int updated = jdbcTemplate.update(
                "update waybill set receiving_order_id = ? where id in (" + placeholders
                        + ") and receiving_order_id is null",
                parameters.toArray()
        );
        if (updated != request.waybillIds().size()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "WAYBILL_ALREADY_LINKED",
                    "Одна из выбранных накладных уже включена в другую заявку"
            );
        }
        return new CreatedOrderResponse(orderId, code, "DRAFT");
    }

    public PagedResponse<OrderSummary> findPage(int requestedPage, int requestedSize, String query, String status) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(1, Math.min(requestedSize, 100));
        long total = jdbcTemplate.queryForObject("select count(*) from receiving_order o join client c on c.id = o.client_id left join contract ct on ct.id = o.contract_id where (? = '' or position(lower(?) in lower(concat_ws(' ', o.code::text, c.code, ct.name))) > 0) and (? = '' or o.status = ?)", Long.class, query, query, status, status);
        List<OrderSummary> items = jdbcTemplate.query(
                """
                select o.id, o.code, o.client_id, c.code as client_name,
                       a.id as area_id, a.code as area_code, a.name as area_name,
                       o.transport_type, o.status, o.contract_id, ct.name as contract_name, o.service_order_id, o.route_id,
                       null::uuid as source_receiving_order_id
                from receiving_order o
                join client c on c.id = o.client_id
                left join contract ct on ct.id = o.contract_id
                join terminal_area_catalog a on a.id = o.terminal_area_catalog_id
                 where (? = '' or position(lower(?) in lower(concat_ws(' ', o.code::text, c.code, ct.name))) > 0) and (? = '' or o.status = ?)
                order by o.code desc
                limit ? offset ?
                """,
                (resultSet, rowNumber) -> new OrderSummary(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getInt("code"),
                        resultSet.getObject("client_id", UUID.class),
                        resultSet.getString("client_name"),
                        terminalArea(resultSet),
                        transportType(resultSet.getString("transport_type")),
                        FillingType.ALL,
                        resultSet.getString("status"),
                        resultSet.getObject("contract_id", UUID.class),
                        resultSet.getString("contract_name"),
                        resultSet.getObject("service_order_id", UUID.class)
                ),
                query, query, status, status, size,
                page * size
        );
        return PagedResponse.of(items, page, size, total);
    }

    public OrderDetails findById(UUID id) {
        List<OrderHeader> headers = jdbcTemplate.query(
                """
                select o.id, o.code, o.client_id, c.code as client_name,
                       a.id as area_id, a.code as area_code, a.name as area_name,
                       o.transport_type, o.status, o.contract_id, ct.name as contract_name, o.service_order_id, o.route_id,
                       null::uuid as source_receiving_order_id, o.arrival_at, o.consignor
                from receiving_order o
                join client c on c.id = o.client_id
                left join contract ct on ct.id = o.contract_id
                join terminal_area_catalog a on a.id = o.terminal_area_catalog_id
                where o.id = ?
                """,
                (resultSet, rowNumber) -> new OrderHeader(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getInt("code"),
                        resultSet.getObject("client_id", UUID.class),
                        resultSet.getString("client_name"),
                        terminalArea(resultSet),
                        transportType(resultSet.getString("transport_type")),
                        resultSet.getString("status"),
                        resultSet.getObject("contract_id", UUID.class),
                        resultSet.getString("contract_name"),
                        resultSet.getObject("service_order_id", UUID.class),
                        resultSet.getObject("route_id", UUID.class),
                        resultSet.getObject("arrival_at", LocalDateTime.class),
                        resultSet.getString("consignor")
                ),
                id
        );
        if (headers.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Заявка не найдена");
        }

        List<OrderContainerDetails> containers = jdbcTemplate.query(
                """
                select oc.container_id, c.code as container_name, oc.empty,
                       item.etsng_code_id, e.code as etsng_code_name, item.weight
                from receiving_order_container oc
                join container c on c.id = oc.container_id
                left join receiving_order_container_item item on item.receiving_order_container_id = oc.id
                left join etsng_code e on e.id = item.etsng_code_id
                where oc.receiving_order_id = ?
                order by c.code
                """,
                (resultSet, rowNumber) -> container(resultSet),
                id
        );

        List<OrderWaybillDetails> waybills = loadWaybills(id);
        OrderHeader header = headers.getFirst();
        return new OrderDetails(
                header.id(), header.code(), header.clientId(), header.clientName(),
                header.terminalArea(), header.transportType(),
                FillingType.ALL, header.status(),
                containers, waybills, List.of(), List.of(), List.of(),
                header.contractId(), header.contractName(), header.serviceOrderId(), null, header.routeId(),
                jdbcTemplate.queryForObject("select source_shipping_order_id from receiving_order where id = ?", UUID.class, id), List.of(),
                header.arrivalAt(), header.consignor(), null, null
        );
    }

    private List<LockedWaybill> lockWaybills(List<UUID> waybillIds) {
        String placeholders = String.join(",", Collections.nCopies(waybillIds.size(), "?"));
        return jdbcTemplate.query(
                "select id, number, receiving_order_id, departure_station, destination_station, payer "
                        + "from waybill where id in (" + placeholders + ") order by id for update",
                (resultSet, rowNumber) -> new LockedWaybill(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("number"),
                        resultSet.getObject("receiving_order_id", UUID.class),
                        resultSet.getInt("departure_station"),
                        resultSet.getInt("destination_station"),
                        resultSet.getString("payer")
                ),
                waybillIds.toArray()
        );
    }

    private Integer insertHeader(UUID orderId, CreateOrderRequest request) {
        return jdbcTemplate.queryForObject(
                "insert into receiving_order "
                        + "(id, client_id, terminal_area_catalog_id, transport_type, contract_id, "
                        + "status, arrival_at, consignor) "
                        + "values (?, ?, ?, ?, ?, 'DRAFT', ?, ?) returning code",
                Integer.class,
                orderId,
                request.clientId(),
                request.terminalAreaId(),
                request.transportType().name(),
                request.contractId(),
                request.arrivalAt(),
                request.consignor()
        );
    }

    private List<OrderWaybillDetails> loadWaybills(UUID orderId) {
        List<WaybillHeader> headers = jdbcTemplate.query(
                "select id, number, departure_station, destination_station, payer "
                        + "from waybill where receiving_order_id = ? order by number, id",
                (resultSet, rowNumber) -> new WaybillHeader(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("number"),
                        resultSet.getInt("departure_station"),
                        resultSet.getInt("destination_station"),
                        resultSet.getString("payer")
                ),
                orderId
        );
        if (headers.isEmpty()) return List.of();

        List<CarriageRow> carriageRows = jdbcTemplate.query(
                """
                select wrc.id, wrc.waybill_id, wrc.railway_carriage_id, rc.code as carriage_number
                  from waybill_railway_carriage wrc
                  join railway_carriage rc on rc.id = wrc.railway_carriage_id
                  join waybill w on w.id = wrc.waybill_id
                 where w.receiving_order_id = ?
                 order by wrc.waybill_id, rc.code, wrc.id
                """,
                (resultSet, rowNumber) -> new CarriageRow(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getObject("waybill_id", UUID.class),
                        resultSet.getObject("railway_carriage_id", UUID.class),
                        resultSet.getString("carriage_number")
                ),
                orderId
        );

        Map<UUID, List<OrderWaybillContainerDetails>> containersByCarriage = new LinkedHashMap<>();
        jdbcTemplate.query(
                """
                select wc.waybill_railway_carriage_id, wc.container_id, c.code as container_number, wc.gross_weight, c.tare_weight as tare_weight, (wc.gross_weight - c.tare_weight) as net_weight, p.etsng_code_id, e.code as etsng_name
                  from waybill_container wc
                  join container c on c.id = wc.container_id
                  left join waybill_product p on p.waybill_container_id = wc.id
                  left join etsng_code e on e.id = p.etsng_code_id
                  join waybill_railway_carriage wrc on wrc.id = wc.waybill_railway_carriage_id
                  join waybill w on w.id = wrc.waybill_id
                 where w.receiving_order_id = ?
                 order by wc.waybill_railway_carriage_id, c.code, wc.id
                """,
                (org.springframework.jdbc.core.RowCallbackHandler) resultSet -> containersByCarriage
                        .computeIfAbsent(
                                resultSet.getObject("waybill_railway_carriage_id", UUID.class),
                                ignored -> new ArrayList<>()
                        )
                        .add(new OrderWaybillContainerDetails(
                                resultSet.getObject("container_id", UUID.class),
                                resultSet.getString("container_number"),
                                resultSet.getBigDecimal("gross_weight"), resultSet.getBigDecimal("tare_weight"), resultSet.getBigDecimal("net_weight"),
                                resultSet.getObject("etsng_code_id", UUID.class), resultSet.getString("etsng_name")
                        )),
                orderId
        );

        Map<UUID, List<OrderWaybillCarriageDetails>> carriagesByWaybill = new LinkedHashMap<>();
        carriageRows.forEach(row -> carriagesByWaybill
                .computeIfAbsent(row.waybillId(), ignored -> new ArrayList<>())
                .add(new OrderWaybillCarriageDetails(
                        row.id(),
                        row.railwayCarriageId(),
                        row.number(),
                        containersByCarriage.getOrDefault(row.id(), List.of())
                )));

        Map<UUID, List<OrderWaybillProductDetails>> productsByWaybill = new LinkedHashMap<>();
        jdbcTemplate.query(
                """
                select p.id, p.waybill_id, p.etsng_code_id, e.code as etsng_code, (wc.gross_weight - c.tare_weight) as weight
                  from waybill_product p
                  join etsng_code e on e.id = p.etsng_code_id
                  join waybill_container wc on wc.id = p.waybill_container_id
                  join container c on c.id = wc.container_id
                  join waybill w on w.id = p.waybill_id
                 where w.receiving_order_id = ?
                 order by p.waybill_id, p.id
                """,
                (org.springframework.jdbc.core.RowCallbackHandler) resultSet -> productsByWaybill
                        .computeIfAbsent(resultSet.getObject("waybill_id", UUID.class), ignored -> new ArrayList<>())
                        .add(new OrderWaybillProductDetails(
                                resultSet.getObject("id", UUID.class),
                                resultSet.getObject("etsng_code_id", UUID.class),
                                resultSet.getString("etsng_code"),
                                resultSet.getBigDecimal("weight")
                        )),
                orderId
        );

        return headers.stream().map(header -> new OrderWaybillDetails(
                header.id(),
                header.number(),
                header.departureStation(),
                header.destinationStation(),
                header.payer(),
                carriagesByWaybill.getOrDefault(header.id(), List.of()),
                productsByWaybill.getOrDefault(header.id(), List.of())
        )).toList();
    }

    private OrderContainerDetails container(ResultSet resultSet) throws SQLException {
        UUID etsngCodeId = resultSet.getObject("etsng_code_id", UUID.class);
        OrderCargoDetails cargo = etsngCodeId == null
                ? null
                : new OrderCargoDetails(
                        etsngCodeId,
                        resultSet.getString("etsng_code_name"),
                        resultSet.getBigDecimal("weight")
                );
        return new OrderContainerDetails(
                resultSet.getObject("container_id", UUID.class),
                resultSet.getString("container_name"),
                resultSet.getBoolean("empty"),
                cargo
        );
    }

    private TerminalAreaDetails terminalArea(ResultSet resultSet) throws SQLException {
        return new TerminalAreaDetails(
                resultSet.getObject("area_id", UUID.class),
                resultSet.getString("area_code"),
                resultSet.getString("area_name")
        );
    }

    private TransportType transportType(String value) {
        return value == null ? null : TransportType.valueOf(value);
    }

    private void insertCargo(UUID orderContainerId, CargoRequest cargo) {
        if (cargo == null) return;
        jdbcTemplate.update(
                "insert into receiving_order_container_item "
                        + "(id, receiving_order_container_id, etsng_code_id, weight) values (?, ?, ?, ?)",
                UUID.randomUUID(), orderContainerId, cargo.etsngCodeId(), cargo.weight()
        );
    }

    private record OrderHeader(
            UUID id,
            int code,
            UUID clientId,
            String clientName,
            TerminalAreaDetails terminalArea,
            TransportType transportType,
            String status,
            UUID contractId,
            String contractName,
            UUID serviceOrderId,
            UUID routeId,
            LocalDateTime arrivalAt,
            String consignor
    ) {
    }

    private record LockedWaybill(
            UUID id,
            String number,
            UUID receivingOrderId,
            int departureStation,
            int destinationStation,
            String payer
    ) {
    }

    private record WaybillHeader(
            UUID id,
            String number,
            int departureStation,
            int destinationStation,
            String payer
    ) {
    }

    private record CarriageRow(
            UUID id,
            UUID waybillId,
            UUID railwayCarriageId,
            String number
    ) {
    }
}
