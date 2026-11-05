package ru.billing.app.order;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
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
        if (request.fillingType()!=null && request.fillingType()!=FillingType.ALL
                || request.railwayCarriageQuantities()!=null && !request.railwayCarriageQuantities().isEmpty()
                || request.containerQuantities()!=null && !request.containerQuantities().isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST,"NUMBERED_COMPOSITION_REQUIRED","Требуется номерной состав");
        UUID orderId = UUID.randomUUID();
        FillingType fillingType = request.fillingType() == null ? FillingType.ALL : request.fillingType();
        Integer code = jdbcTemplate.queryForObject(
                "insert into shipping_order "
                        + "(id, client_id, terminal_area_catalog_id, transport_type, contract_id, "
                        + "filling_type, order_status, planned_shipping_date_time, consignee_id) "
                        + "values (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?) returning number",
                Integer.class,
                orderId,
                request.clientId(),
                request.terminalAreaId(),
                request.transportType().name(),
                request.contractId(),
                fillingType.name(),
                request.departureAt(),
                ru.billing.app.reference.PartyReferences.clientParty(jdbcTemplate, request.consignee())
        );

        if (request.transportType() == TransportType.VEHICLE) request.containers().forEach(container -> insertContainer(orderId,null,container));
        else insertAllComposition(orderId,request);

        jdbcTemplate.update("update shipping_order set authorized_representative=?, phone=?, email=?, comment=?, transport_waybill_number=? where id=?",
                request.authorizedRepresentative(), request.phone(), request.email(), request.comment(), request.transportWaybillNumber(), orderId);
        return new CreatedOrderResponse(orderId, code, "DRAFT");
    }

    public PagedResponse<OrderSummary> findPage(int requestedPage, int requestedSize, String query, String status) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(1, Math.min(requestedSize, 100));
        long total = jdbcTemplate.queryForObject("select count(*) from shipping_order o join client c on c.id = o.client_id left join contract ct on ct.id = o.contract_id where (? = '' or position(lower(?) in lower(concat_ws(' ', o.number::text, c.name, ct.name))) > 0) and (? = '' or o.order_status = ?)", Long.class, query, query, status, status);
        List<OrderSummary> items = jdbcTemplate.query(
                """
                select o.id, o.number as code, o.client_id, c.name as client_name,
                       o.planned_shipping_date_time as planned_at,
                       r.number as route_number, cs.code as service_number, o.comment,
                       a.id as area_id, a.code as area_code, a.name as area_name,
                       o.transport_type, o.filling_type, o.order_status as status, o.contract_id, ct.name as contract_name, o.comprehensive_service_order_id, o.route_id,
                       o.source_receiving_order_id as source_receiving_order_id
                from shipping_order o
                join client c on c.id = o.client_id
                left join contract ct on ct.id = o.contract_id
                left join route r on r.id = o.route_id
                left join comprehensive_service_order cs on cs.id = o.comprehensive_service_order_id
                join terminal_area_catalog a on a.id = o.terminal_area_catalog_id
                 where (? = '' or position(lower(?) in lower(concat_ws(' ', o.number::text, c.name, ct.name))) > 0) and (? = '' or o.order_status = ?)
                order by o.number desc
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
                        resultSet.getObject("comprehensive_service_order_id", UUID.class),
                        resultSet.getObject("planned_at", LocalDateTime.class),
                        resultSet.getObject("route_id", UUID.class),
                        resultSet.getObject("route_number", Integer.class),
                        resultSet.getObject("service_number", Integer.class),
                        resultSet.getString("comment")
                ),
                query, query, status, status, size,
                page * size
        );
        return PagedResponse.of(items, page, size, total);
    }

    public OrderDetails findById(UUID id) {
        List<OrderHeader> headers = jdbcTemplate.query(
                """
                select o.id, o.number as code, o.client_id, c.name as client_name,
                       a.id as area_id, a.code as area_code, a.name as area_name,
                       o.transport_type, o.filling_type, o.order_status as status, o.contract_id, ct.name as contract_name, o.comprehensive_service_order_id, o.route_id,
                       o.source_receiving_order_id as source_receiving_order_id, o.planned_shipping_date_time as departure_at, (select name from client_related_entity where id=o.consignee_id) as consignee,
                       o.authorized_representative, o.phone, o.email, o.comment, ct.contract_type, o.created_at, o.transport_waybill_number
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
                        resultSet.getObject("comprehensive_service_order_id", UUID.class),
                        resultSet.getObject("source_receiving_order_id", UUID.class),
                        resultSet.getObject("route_id", UUID.class),
                        resultSet.getObject("departure_at", LocalDateTime.class),
                        resultSet.getString("consignee"), resultSet.getString("authorized_representative"), resultSet.getString("phone"), resultSet.getString("email"), resultSet.getString("comment"), resultSet.getString("contract_type"), resultSet.getObject("created_at", java.time.OffsetDateTime.class), resultSet.getString("transport_waybill_number")
                ),
                id
        );
        if (headers.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Заявка не найдена");
        }

        OrderHeader header = headers.getFirst();
        List<OrderContainerDetails> containers = header.transportType()==TransportType.VEHICLE ? loadContainers(id) : List.of();
        List<ShippingOrderRailwayCarriageDetails> railwayCarriages = header.transportType()==TransportType.RAILWAY ? loadRailwayCarriages(id) : List.of();
        // Empty compatibility fields; quantity-based composition is no longer supported.
        List<RailwayCarriageQuantityDetails> carriageQuantities=List.of();
        List<ContainerQuantityDetails> containerQuantities=List.of();

        List<ReturnReceivingOrder> returns = jdbcTemplate.query("""
                select r.id, r.number as code, r.order_status as status, r.plan_receiving_date_time, r.consignor, array_agg(c.code order by c.code) as container_names
                from receiving_order r join receiving_order_container rc on rc.receiving_order_id = r.id
                join container c on c.id = rc.container_id
                where r.source_shipping_order_id = ? group by r.id order by r.number
                """, (rs, row) -> new ReturnReceivingOrder(rs.getObject("id", UUID.class), rs.getInt("code"),
                        rs.getString("status"), java.util.Arrays.stream((Object[]) rs.getArray("container_names").getArray()).map(Object::toString).toList(), rs.getObject("plan_receiving_date_time", java.time.LocalDateTime.class), rs.getString("consignor")), id);
        return new OrderDetails(
                header.id(), header.code(), header.clientId(), header.clientName(),
                header.terminalArea(), header.transportType(),
                header.fillingType(), header.status(),
                containers, List.of(), railwayCarriages, carriageQuantities, containerQuantities,
                header.contractId(), header.contractName(), header.comprehensiveServiceOrderId(), header.sourceReceivingOrderId(), header.routeId(), null, returns,
                null, null, header.departureAt(), header.consignee(), null, null, header.authorizedRepresentative(), header.phone(), header.email(), header.comment(), header.contractType(), header.createdAt(), header.transportWaybillNumber()
        );
    }

    public void updateContainerAttributes(UUID id, UpdateOrderContainersRequest request) {
        var headers = jdbcTemplate.query("select order_status as status, transport_type from shipping_order where id = ? for update",
                (rs, row) -> List.of(rs.getString("status"), rs.getString("transport_type")), id);
        if (headers.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Заявка не найдена");
        if (!"DRAFT".equals(headers.getFirst().getFirst())) {
            throw new ApiException(HttpStatus.CONFLICT, "CONTAINER_ATTRIBUTES_NOT_EDITABLE", "Реквизиты КТК можно менять только в черновике вывоза");
        }
        if(request.metadata()!=null) {
            jdbcTemplate.update("update shipping_order set planned_shipping_date_time=?, consignee_id=? where id=?", request.metadata().plannedAt(), ru.billing.app.reference.PartyReferences.clientParty(jdbcTemplate, request.metadata().consignee()), id);
        }
        var seen = new java.util.HashSet<UUID>();
        for (var c : request.containers()) {
            if (!seen.add(c.containerId())) throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_CONTAINER", "КТК указан дважды");
            int count = jdbcTemplate.update("update shipping_order_container set owner_container_id = ?, seal_numbers = ?, seal_type_id = ?, danger_class_id = ? where shipping_order_id = ? and container_id = ?",
                    registryOwner(c.containerId()), c.sealNumbers(), c.sealTypeId(), c.hazardClassId(), id, c.containerId());
            if (count != 1) throw new ApiException(HttpStatus.NOT_FOUND, "ORDER_CONTAINER_NOT_FOUND", "КТК отсутствует в этой заявке");
        }
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





    private UUID registryOwner(UUID containerId) {
        return jdbcTemplate.queryForObject("select (select client_id from container_owner where container_id=?)", UUID.class, containerId);
    }
    UUID insertContainer(UUID orderId, UUID carriageRowId, OrderContainerRequest container) {
        UUID orderContainerId = UUID.randomUUID();
        jdbcTemplate.update(
                "insert into shipping_order_container "
                        + "(id, shipping_order_id, shipping_order_railway_carriage_id, container_id, empty, owner_container_id, seal_numbers, seal_type_id, danger_class_id) "
                        + "values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                orderContainerId,
                orderId,
                carriageRowId,
                container.containerId(),
                container.empty(), registryOwner(container.containerId()), container.sealNumbers(), container.sealTypeId(), container.hazardClassId()
        );
        for (var cargo : container.cargoItems()) insertCargo(orderContainerId, cargo);
        return orderContainerId;
    }

    private void insertCargo(UUID orderContainerId, CargoRequest cargo) {
        if (cargo == null) return;
        jdbcTemplate.update(
                "insert into shipping_order_container_item "
                        + "(id, shipping_order_container_id, etsng_code_id, wight_net) values (?, ?, ?, ?)",
                UUID.randomUUID(), orderContainerId, cargo.etsngCodeId(), cargo.weight()
        );
    }

    private List<OrderContainerDetails> loadContainers(UUID orderId) {
        return OrderContainerDetails.merge(jdbcTemplate.query(
                """
                select oc.container_id, c.code as container_name, oc.empty,
                       case when so.order_status = 'DRAFT' then stock.client_id else oc.owner_container_id end as owner_container_id, owner.name as owner_container_name, oc.seal_numbers,
                       oc.seal_type_id, st.code as seal_type_name, oc.danger_class_id, hc.code as danger_class_name,
                       item.etsng_code_id, e.code as etsng_code_name, item.wight_net, stock.status as container_status
                  from shipping_order_container oc
                  join container c on c.id = oc.container_id
                  left join shipping_order so on so.id = oc.shipping_order_id
                  left join container_owner stock on stock.container_id = oc.container_id
                  left join client owner on owner.id = case when so.order_status = 'DRAFT' then stock.client_id else oc.owner_container_id end
                  left join seal_type st on st.id = oc.seal_type_id
                  left join danger_class hc on hc.id = oc.danger_class_id
                  left join shipping_order_container_item item on item.shipping_order_container_id = oc.id
                  left join etsng_code e on e.id = item.etsng_code_id
                 where oc.shipping_order_id = ?
                 order by c.code
                """,
                (resultSet, rowNumber) -> container(resultSet),
                orderId
        ));
    }

    private List<ShippingOrderRailwayCarriageDetails> loadRailwayCarriages(UUID orderId) {
        List<RailwayContainerRow> rows = jdbcTemplate.query(
                """
                select sorc.id as carriage_row_id, sorc.railway_carriage_id,
                       rc.code as railway_carriage_code,
                       oc.container_id, c.code as container_name, oc.empty,
                       case when so.order_status = 'DRAFT' then stock.client_id else oc.owner_container_id end as owner_container_id, owner.name as owner_container_name, oc.seal_numbers,
                       oc.seal_type_id, st.code as seal_type_name, oc.danger_class_id, hc.code as danger_class_name,
                       item.etsng_code_id, e.code as etsng_code_name, item.wight_net, stock.status as container_status
                  from shipping_order_railway_carriage sorc
                  join railway_carriage rc on rc.id = sorc.railway_carriage_id
                  left join shipping_order_container oc
                    on oc.shipping_order_railway_carriage_id = sorc.id
                   and oc.shipping_order_id = sorc.shipping_order_id
                  left join container c on c.id = oc.container_id
                  join shipping_order so on so.id = oc.shipping_order_id
                  left join container_owner stock on stock.container_id = oc.container_id
                  left join client owner on owner.id = case when so.order_status = 'DRAFT' then stock.client_id else oc.owner_container_id end
                  left join seal_type st on st.id = oc.seal_type_id
                  left join danger_class hc on hc.id = oc.danger_class_id
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
                builder.railwayCarriageId(), builder.railwayCarriageCode(), OrderContainerDetails.merge(builder.containers())
        )).toList();
    }







    private OrderContainerDetails container(ResultSet resultSet) throws SQLException {
        UUID etsngCodeId = resultSet.getObject("etsng_code_id", UUID.class);
        OrderCargoDetails cargo = etsngCodeId == null
                ? null
                : new OrderCargoDetails(
                        etsngCodeId,
                        resultSet.getString("etsng_code_name"),
                        resultSet.getBigDecimal("wight_net")
                );
        return new OrderContainerDetails(
                resultSet.getObject("container_id", UUID.class),
                resultSet.getString("container_name"),
                resultSet.getBoolean("empty"),
                cargo,
                resultSet.getObject("owner_container_id", UUID.class), resultSet.getString("owner_container_name"),
                resultSet.getString("seal_numbers"),
                resultSet.getObject("seal_type_id", UUID.class), resultSet.getString("seal_type_name"),
                resultSet.getObject("danger_class_id", UUID.class), resultSet.getString("danger_class_name"),
                cargo == null ? List.of() : List.of(cargo), resultSet.getString("container_status")
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
            UUID comprehensiveServiceOrderId,
            UUID sourceReceivingOrderId,
            UUID routeId,
            LocalDateTime departureAt,
            String consignee, String authorizedRepresentative, String phone, String email, String comment, String contractType, java.time.OffsetDateTime createdAt, String transportWaybillNumber
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


}
