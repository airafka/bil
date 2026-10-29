package ru.billing.app.order;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import ru.billing.app.error.ApiException;

@Repository
public class ShippingOrderStore {

    private final JdbcTemplate jdbcTemplate;

    public ShippingOrderStore(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public CreatedOrderResponse create(CreateOrderRequest request) {
        UUID orderId = UUID.randomUUID();
        FillingType fillingType = request.fillingType() == null ? FillingType.ALL : request.fillingType();
        Integer code = jdbcTemplate.queryForObject(
                "insert into shipping_order "
                        + "(id, client_id, terminal_area_catalog_id, transport_type, contract_id, "
                        + "filling_type, status) "
                        + "values (?, ?, ?, ?, ?, ?, 'DRAFT') returning code",
                Integer.class,
                orderId,
                request.clientId(),
                request.terminalAreaId(),
                request.transportType().name(),
                request.contractId(),
                fillingType.name()
        );

        if (fillingType == FillingType.VEHICLE_UNNUMBERED) {
            insertContainerQuantities(orderId, request.containerQuantities());
        } else if (request.transportType() == TransportType.VEHICLE) {
            request.containers().forEach(container -> insertContainer(orderId, null, container));
        } else {
            switch (fillingType) {
                case ALL -> insertAllComposition(orderId, request);
                case RAILWAY_CARRIAGE -> {
                    insertNumberedCarriages(orderId, request, false);
                    insertContainerQuantities(orderId, request.containerQuantities());
                }
                case CONTAINER -> {
                    insertRailwayCarriageQuantities(orderId, request.railwayCarriageQuantities());
                    request.containers().forEach(container -> insertContainer(orderId, null, container));
                }
                case NONE -> {
                    insertRailwayCarriageQuantities(orderId, request.railwayCarriageQuantities());
                    insertContainerQuantities(orderId, request.containerQuantities());
                }
                case VEHICLE_UNNUMBERED -> throw new IllegalStateException(
                        "VEHICLE_UNNUMBERED must be handled before railway composition"
                );
            }
        }

        return new CreatedOrderResponse(orderId, code, "DRAFT");
    }

    public PagedResponse<OrderSummary> findPage(int requestedPage, int requestedSize, String query, String status) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(1, Math.min(requestedSize, 100));
        long total = jdbcTemplate.queryForObject("select count(*) from shipping_order o join client c on c.id = o.client_id left join contract ct on ct.id = o.contract_id where (? = '' or position(lower(?) in lower(concat_ws(' ', o.code::text, c.code, ct.name))) > 0) and (? = '' or o.status = ?)", Long.class, query, query, status, status);
        List<OrderSummary> items = jdbcTemplate.query(
                """
                select o.id, o.code, o.client_id, c.code as client_name,
                       a.id as area_id, a.code as area_code, a.name as area_name,
                       o.transport_type, o.filling_type, o.status, o.contract_id, ct.name as contract_name, o.service_order_id, o.route_id,
                       o.source_receiving_order_id as source_receiving_order_id
                from shipping_order o
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
                        fillingType(resultSet.getString("filling_type")),
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
                       o.transport_type, o.filling_type, o.status, o.contract_id, ct.name as contract_name, o.service_order_id, o.route_id,
                       o.source_receiving_order_id as source_receiving_order_id
                from shipping_order o
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
                        fillingType(resultSet.getString("filling_type")),
                        resultSet.getString("status"),
                        resultSet.getObject("contract_id", UUID.class),
                        resultSet.getString("contract_name"),
                        resultSet.getObject("service_order_id", UUID.class),
                        resultSet.getObject("source_receiving_order_id", UUID.class),
                        resultSet.getObject("route_id", UUID.class)
                ),
                id
        );
        if (headers.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Заявка не найдена");
        }

        OrderHeader header = headers.getFirst();
        boolean numberedContainersAtTop = (header.transportType() == TransportType.VEHICLE
                && header.fillingType() == FillingType.ALL)
                || header.fillingType() == FillingType.CONTAINER;
        List<OrderContainerDetails> containers = numberedContainersAtTop ? loadContainers(id) : List.of();
        List<ShippingOrderRailwayCarriageDetails> railwayCarriages =
                header.transportType() == TransportType.RAILWAY
                        && (header.fillingType() == FillingType.ALL
                        || header.fillingType() == FillingType.RAILWAY_CARRIAGE)
                        ? loadRailwayCarriages(id)
                        : List.of();
        List<RailwayCarriageQuantityDetails> carriageQuantities =
                header.transportType() == TransportType.RAILWAY
                        && (header.fillingType() == FillingType.CONTAINER || header.fillingType() == FillingType.NONE)
                        ? loadRailwayCarriageQuantities(id)
                        : List.of();
        List<ContainerQuantityDetails> containerQuantities =
                (header.transportType() == TransportType.RAILWAY
                        && (header.fillingType() == FillingType.RAILWAY_CARRIAGE
                        || header.fillingType() == FillingType.NONE))
                        || header.fillingType() == FillingType.VEHICLE_UNNUMBERED
                        ? loadContainerQuantities(id)
                        : List.of();

        List<ReturnReceivingOrder> returns = jdbcTemplate.query("""
                select r.id, r.code, r.status, array_agg(c.code order by c.code) as container_names
                from receiving_order r join receiving_order_container rc on rc.receiving_order_id = r.id
                join container c on c.id = rc.container_id
                where r.source_shipping_order_id = ? group by r.id order by r.code
                """, (rs, row) -> new ReturnReceivingOrder(rs.getObject("id", UUID.class), rs.getInt("code"),
                        rs.getString("status"), java.util.Arrays.stream((Object[]) rs.getArray("container_names").getArray()).map(Object::toString).toList()), id);
        return new OrderDetails(
                header.id(), header.code(), header.clientId(), header.clientName(),
                header.terminalArea(), header.transportType(),
                header.fillingType(), header.status(),
                containers, List.of(), railwayCarriages, carriageQuantities, containerQuantities,
                header.contractId(), header.contractName(), header.serviceOrderId(), header.sourceReceivingOrderId(), header.routeId(), null, returns
        );
    }

    private void insertAllComposition(UUID orderId, CreateOrderRequest request) {
        insertNumberedCarriages(orderId, request, true);
    }

    private void insertNumberedCarriages(UUID orderId, CreateOrderRequest request, boolean withContainers) {
        for (ShippingOrderRailwayCarriageRequest carriage : request.railwayCarriages()) {
            UUID carriageRowId = UUID.randomUUID();
            jdbcTemplate.update(
                    "insert into shipping_order_railway_carriage (id, shipping_order_id, railway_carriage_id) "
                            + "values (?, ?, ?)",
                    carriageRowId,
                    orderId,
                    carriage.railwayCarriageId()
            );
            if (withContainers) {
                carriage.containers().forEach(container -> insertContainer(orderId, carriageRowId, container));
            }
        }
    }

    private void insertRailwayCarriageQuantities(UUID orderId, List<RailwayCarriageQuantityRequest> rows) {
        for (RailwayCarriageQuantityRequest row : rows) {
            jdbcTemplate.update(
                    "insert into shipping_order_railway_carriage_qty (id, shipping_order_id, quantity, type_id) "
                            + "values (?, ?, ?, ?)",
                    UUID.randomUUID(), orderId, row.quantity(), row.typeId()
            );
        }
    }

    private void insertContainerQuantities(UUID orderId, List<ContainerQuantityRequest> rows) {
        for (ContainerQuantityRequest row : rows) {
            UUID rowId = UUID.randomUUID();
            jdbcTemplate.update(
                    "insert into shipping_order_container_qty (id, shipping_order_id, quantity, type, empty) "
                            + "values (?, ?, ?, ?, ?)",
                    rowId, orderId, row.quantity(), row.type().name(), row.empty()
            );
            List<CargoRequest> items = row.items() == null ? List.of() : row.items();
            for (CargoRequest item : items) {
                jdbcTemplate.update(
                        "insert into shipping_order_etsng_code "
                                + "(id, shipping_order_container_qty_id, etsng_code_id, weight) values (?, ?, ?, ?)",
                        UUID.randomUUID(), rowId, item.etsngCodeId(), item.weight()
                );
            }
        }
    }

    private UUID insertContainer(UUID orderId, UUID carriageRowId, OrderContainerRequest container) {
        UUID orderContainerId = UUID.randomUUID();
        jdbcTemplate.update(
                "insert into shipping_order_container "
                        + "(id, shipping_order_id, shipping_order_railway_carriage_id, container_id, empty) "
                        + "values (?, ?, ?, ?, ?)",
                orderContainerId,
                orderId,
                carriageRowId,
                container.containerId(),
                container.empty()
        );
        insertCargo(orderContainerId, container.cargo());
        return orderContainerId;
    }

    private void insertCargo(UUID orderContainerId, CargoRequest cargo) {
        if (cargo == null) return;
        jdbcTemplate.update(
                "insert into shipping_order_container_item "
                        + "(id, shipping_order_container_id, etsng_code_id, weight) values (?, ?, ?, ?)",
                UUID.randomUUID(), orderContainerId, cargo.etsngCodeId(), cargo.weight()
        );
    }

    private List<OrderContainerDetails> loadContainers(UUID orderId) {
        return jdbcTemplate.query(
                """
                select oc.container_id, c.code as container_name, oc.empty,
                       item.etsng_code_id, e.code as etsng_code_name, item.weight
                  from shipping_order_container oc
                  join container c on c.id = oc.container_id
                  left join shipping_order_container_item item on item.shipping_order_container_id = oc.id
                  left join etsng_code e on e.id = item.etsng_code_id
                 where oc.shipping_order_id = ?
                 order by c.code
                """,
                (resultSet, rowNumber) -> container(resultSet),
                orderId
        );
    }

    private List<ShippingOrderRailwayCarriageDetails> loadRailwayCarriages(UUID orderId) {
        List<RailwayContainerRow> rows = jdbcTemplate.query(
                """
                select sorc.id as carriage_row_id, sorc.railway_carriage_id,
                       rc.code as railway_carriage_code,
                       oc.container_id, c.code as container_name, oc.empty,
                       item.etsng_code_id, e.code as etsng_code_name, item.weight
                  from shipping_order_railway_carriage sorc
                  join railway_carriage rc on rc.id = sorc.railway_carriage_id
                  left join shipping_order_container oc
                    on oc.shipping_order_railway_carriage_id = sorc.id
                   and oc.shipping_order_id = sorc.shipping_order_id
                  left join container c on c.id = oc.container_id
                  left join shipping_order_container_item item on item.shipping_order_container_id = oc.id
                  left join etsng_code e on e.id = item.etsng_code_id
                 where sorc.shipping_order_id = ?
                 order by rc.code, sorc.id, c.code
                """,
                (resultSet, rowNumber) -> new RailwayContainerRow(
                        resultSet.getObject("carriage_row_id", UUID.class),
                        resultSet.getObject("railway_carriage_id", UUID.class),
                        resultSet.getString("railway_carriage_code"),
                        resultSet.getObject("container_id", UUID.class) == null ? null : container(resultSet)
                ),
                orderId
        );
        Map<UUID, RailwayCarriageBuilder> grouped = new LinkedHashMap<>();
        rows.forEach(row -> {
            RailwayCarriageBuilder builder = grouped.computeIfAbsent(
                    row.carriageRowId(),
                    ignored -> new RailwayCarriageBuilder(
                            row.railwayCarriageId(), row.railwayCarriageCode(), new ArrayList<>()
                    )
            );
            if (row.container() != null) builder.containers().add(row.container());
        });
        return grouped.values().stream().map(builder -> new ShippingOrderRailwayCarriageDetails(
                builder.railwayCarriageId(), builder.railwayCarriageCode(), List.copyOf(builder.containers())
        )).toList();
    }

    private List<RailwayCarriageQuantityDetails> loadRailwayCarriageQuantities(UUID orderId) {
        return jdbcTemplate.query(
                """
                select qty.id, qty.quantity, qty.type_id, type.code as type_code, type.name as type_name
                  from shipping_order_railway_carriage_qty qty
                  left join railway_carriage_type type on type.id = qty.type_id
                 where qty.shipping_order_id = ?
                 order by type.name nulls first, qty.id
                """,
                (resultSet, rowNumber) -> new RailwayCarriageQuantityDetails(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getInt("quantity"),
                        resultSet.getObject("type_id", UUID.class),
                        resultSet.getString("type_code"),
                        resultSet.getString("type_name")
                ),
                orderId
        );
    }

    private List<ContainerQuantityDetails> loadContainerQuantities(UUID orderId) {
        List<ContainerQuantityHeader> headers = jdbcTemplate.query(
                """
                select id, quantity, type, empty
                  from shipping_order_container_qty
                 where shipping_order_id = ?
                 order by type, empty desc, id
                """,
                (resultSet, rowNumber) -> new ContainerQuantityHeader(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getInt("quantity"),
                        ContainerType.valueOf(resultSet.getString("type")),
                        resultSet.getBoolean("empty")
                ),
                orderId
        );
        return headers.stream().map(header -> new ContainerQuantityDetails(
                header.id(), header.quantity(), header.type(), header.empty(), loadContainerQuantityItems(header.id())
        )).toList();
    }

    private List<ContainerQuantityItemDetails> loadContainerQuantityItems(UUID rowId) {
        return jdbcTemplate.query(
                """
                select item.id, item.etsng_code_id, code.code as etsng_code, item.weight
                  from shipping_order_etsng_code item
                  join etsng_code code on code.id = item.etsng_code_id
                 where item.shipping_order_container_qty_id = ?
                 order by code.code, item.weight
                """,
                (resultSet, rowNumber) -> new ContainerQuantityItemDetails(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getObject("etsng_code_id", UUID.class),
                        resultSet.getString("etsng_code"),
                        resultSet.getBigDecimal("weight")
                ),
                rowId
        );
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

    private FillingType fillingType(String value) {
        return value == null ? FillingType.ALL : FillingType.valueOf(value);
    }

    private record OrderHeader(
            UUID id,
            int code,
            UUID clientId,
            String clientName,
            TerminalAreaDetails terminalArea,
            TransportType transportType,
            FillingType fillingType,
            String status,
            UUID contractId,
            String contractName,
            UUID serviceOrderId,
            UUID sourceReceivingOrderId,
            UUID routeId
    ) {
    }

    private record RailwayContainerRow(
            UUID carriageRowId,
            UUID railwayCarriageId,
            String railwayCarriageCode,
            OrderContainerDetails container
    ) {
    }

    private record RailwayCarriageBuilder(
            UUID railwayCarriageId,
            String railwayCarriageCode,
            List<OrderContainerDetails> containers
    ) {
    }

    private record ContainerQuantityHeader(
            UUID id,
            int quantity,
            ContainerType type,
            boolean empty
    ) {
    }
}
