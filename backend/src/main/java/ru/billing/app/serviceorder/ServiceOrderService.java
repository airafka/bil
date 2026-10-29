package ru.billing.app.serviceorder;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.*;

@Service
public class ServiceOrderService {
    private final JdbcTemplate jdbc;
    private final ReceivingOrderService receiving;
    private final ShippingOrderService shipping;

    public ServiceOrderService(JdbcTemplate jdbc, ReceivingOrderService receiving, ShippingOrderService shipping) {
        this.jdbc = jdbc;
        this.receiving = receiving;
        this.shipping = shipping;
    }

    @Transactional
    public ServiceOrderDetails create(CreateServiceOrderRequest request) {
        if (request.clientId() == null || request.contractId() == null) {
            throw error(HttpStatus.BAD_REQUEST, "CLIENT_CONTRACT_REQUIRED", "Выберите клиента и договор");
        }
        List<UUID> areas = jdbc.query("select id from terminal_area_catalog where code = 'CONTAINER'",
                (rs, row) -> rs.getObject("id", UUID.class));
        if (areas.isEmpty()) throw error(HttpStatus.NOT_FOUND, "TERMINAL_AREA_NOT_FOUND", "Контейнерная площадка не найдена");
        UUID areaId = areas.getFirst();
        Integer serviceCode = jdbc.queryForObject("select nextval('order_code_seq')", Integer.class);
        CreatedOrderResponse delivery = receiving.create(new CreateOrderRequest(
                request.clientId(), request.contractId(), areaId, TransportType.RAILWAY,
                List.of(), request.waybillIds(), List.of(), FillingType.ALL, List.of(), List.of()));
        UUID id = UUID.randomUUID();
        jdbc.update("insert into service_order(id, code, client_id, contract_id) values (?, ?, ?, ?)",
                id, serviceCode, request.clientId(), request.contractId());
        jdbc.update("update receiving_order set service_order_id = ? where id = ?", id, delivery.id());

        List<SourceRow> sources = loadSources(delivery.id());
        List<OrderContainerRequest> containers = ServiceOrderCargoPlanner.plan(
                sources.stream().map(SourceRow::cargo).toList());
        if (containers.isEmpty()) throw error(HttpStatus.BAD_REQUEST, "SERVICE_ORDER_CONTAINERS_REQUIRED",
                "В выбранных накладных нет КТК для вывоза");
        Map<UUID, String> types = typesByContainer(sources);
        for (OrderContainerRequest container : containers) {
            String type = requireType(types, container.containerId());
            if ("STANDARD_40".equals(type)) {
                createShipping(id, delivery.id(), request.clientId(), request.contractId(), areaId, List.of(container));
            }
        }
        return findById(id);
    }

    @Transactional
    public ServiceOrderDetails createShippingForTwentyFootContainers(UUID serviceId, List<UUID> containerIds) {
        if (containerIds == null || containerIds.isEmpty() || containerIds.size() > 2
                || containerIds.contains(null) || new LinkedHashSet<>(containerIds).size() != containerIds.size()) {
            throw error(HttpStatus.BAD_REQUEST, "INVALID_CONTAINER_SELECTION", "Выберите один или два разных КТК стандарта 20");
        }
        List<ServiceHeader> services = jdbc.query(
                "select client_id, contract_id, status from service_order where id = ? for update",
                (rs, row) -> new ServiceHeader(rs.getObject("client_id", UUID.class),
                        rs.getObject("contract_id", UUID.class), rs.getString("status")), serviceId);
        if (services.isEmpty()) throw error(HttpStatus.NOT_FOUND, "SERVICE_ORDER_NOT_FOUND", "Заявка на услугу не найдена");
        ServiceHeader service = services.getFirst();
        if ("COMPLETED".equals(service.status())) throw error(HttpStatus.CONFLICT, "SERVICE_ORDER_COMPLETED",
                "Нельзя создавать заявки на вывоз для выполненной услуги");
        UUID deliveryId = jdbc.queryForObject(
                "select id from receiving_order where service_order_id = ? and service_role = 'INITIAL_RECEIVING'",
                UUID.class, serviceId);
        List<SourceRow> sources = loadSources(deliveryId);
        Map<UUID, String> types = typesByContainer(sources);
        Map<UUID, OrderContainerRequest> planned = new HashMap<>();
        for (OrderContainerRequest container : ServiceOrderCargoPlanner.plan(
                sources.stream().map(SourceRow::cargo).toList())) planned.put(container.containerId(), container);
        List<OrderContainerRequest> selected = new ArrayList<>();
        for (UUID containerId : containerIds) {
            if (!"STANDARD_20".equals(types.get(containerId)) || !planned.containsKey(containerId)) {
                throw error(HttpStatus.BAD_REQUEST, "CONTAINER_NOT_AVAILABLE", "Выберите КТК стандарта 20 из данной поставки");
            }
            Integer assigned = jdbc.queryForObject("select count(*) from shipping_order_source_container "
                    + "where service_order_id = ? and container_id = ?", Integer.class, serviceId, containerId);
            if (assigned != null && assigned > 0) throw error(HttpStatus.CONFLICT, "CONTAINER_ALREADY_SHIPPED",
                    "Для выбранного КТК уже создана заявка на вывоз");
            selected.add(planned.get(containerId));
        }
        UUID areaId = jdbc.queryForObject("select terminal_area_catalog_id from receiving_order where id = ?",
                UUID.class, deliveryId);
        createShipping(serviceId, deliveryId, service.clientId(), service.contractId(), areaId, selected);
        return findById(serviceId);
    }

    private void createShipping(UUID serviceId, UUID deliveryId, UUID clientId, UUID contractId,
            UUID areaId, List<OrderContainerRequest> containers) {
        CreatedOrderResponse created = shipping.create(new CreateOrderRequest(clientId, contractId, areaId,
                TransportType.VEHICLE, containers, List.of(), List.of(), FillingType.ALL, List.of(), List.of()));
        jdbc.update("update shipping_order set service_order_id = ?, source_receiving_order_id = ? where id = ?",
                serviceId, deliveryId, created.id());
        for (OrderContainerRequest container : containers) {
            jdbc.update("insert into shipping_order_source_container(shipping_order_id, service_order_id, container_id) "
                    + "values (?, ?, ?)", created.id(), serviceId, container.containerId());
        }
    }

    private List<SourceRow> loadSources(UUID deliveryId) {
        jdbc.query("""
                select c.id from container c where c.id in (
                    select wc.container_id from waybill w
                    join waybill_railway_carriage rc on rc.waybill_id = w.id
                    join waybill_container wc on wc.waybill_railway_carriage_id = rc.id
                    where w.receiving_order_id = ?
                ) order by c.id for share
                """, (rs, row) -> rs.getObject("id", UUID.class), deliveryId);
        return jdbc.query("""
                select wc.container_id, wc.gross_weight, c.tare_weight, c.type, p.etsng_code_id
                from waybill w
                join waybill_railway_carriage rc on rc.waybill_id = w.id
                join waybill_container wc on wc.waybill_railway_carriage_id = rc.id
                join container c on c.id = wc.container_id
                left join waybill_product p on p.waybill_container_id = wc.id
                where w.receiving_order_id = ? order by wc.container_id, wc.id
                """, (rs, row) -> new SourceRow(new ServiceOrderCargoPlanner.SourceContainer(
                        rs.getObject("container_id", UUID.class), rs.getObject("etsng_code_id", UUID.class),
                        rs.getBigDecimal("gross_weight"), rs.getBigDecimal("tare_weight")), rs.getString("type")), deliveryId);
    }

    private static Map<UUID, String> typesByContainer(List<SourceRow> sources) {
        Map<UUID, String> types = new HashMap<>();
        for (SourceRow source : sources) types.put(source.cargo().containerId(), source.type());
        return types;
    }

    private static String requireType(Map<UUID, String> types, UUID containerId) {
        String type = types.get(containerId);
        if (!"STANDARD_20".equals(type) && !"STANDARD_40".equals(type)) {
            throw error(HttpStatus.BAD_REQUEST, "CONTAINER_TYPE_REQUIRED", "У КТК должен быть указан тип Стандартный 20 или 40");
        }
        return type;
    }

    private static final String SUMMARY_SQL = """
            select s.id, s.code, s.client_id, c.code as client_name, s.contract_id,
                   ct.name as contract_name, s.status,
                   (select count(*) from shipping_order sh where sh.service_order_id = s.id) as shipping_count
              from service_order s join client c on c.id = s.client_id
              join contract ct on ct.id = s.contract_id
            """;

    @Transactional(readOnly = true)
    public PagedResponse<ServiceOrderSummary> findPage(int requestedPage, int requestedSize) {
        return findPage(requestedPage, requestedSize, "", "");
    }

    @Transactional(readOnly = true)
    public PagedResponse<ServiceOrderSummary> findPage(int requestedPage, int requestedSize, String query, String status) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(1, Math.min(requestedSize, 100));
        long total = jdbc.queryForObject("select count(*) from service_order s join client c on c.id = s.client_id join contract ct on ct.id = s.contract_id where (? = '' or position(lower(?) in lower(concat_ws(' ', s.code::text, c.code, ct.name))) > 0) and (? = '' or s.status = ?)", Long.class, query, query, status, status);
        List<ServiceOrderSummary> items = jdbc.query(SUMMARY_SQL + " where (? = '' or position(lower(?) in lower(concat_ws(' ', s.code::text, c.code, ct.name))) > 0) and (? = '' or s.status = ?) order by s.code desc limit ? offset ?",
                (rs, row) -> summary(rs), query, query, status, status, size, page * size);
        return PagedResponse.of(items, page, size, total);
    }

    @Transactional(readOnly = true)
    public ServiceOrderDetails findById(UUID id) {
        List<ServiceOrderSummary> rows = jdbc.query(SUMMARY_SQL + " where s.id = ?", (rs, row) -> summary(rs), id);
        if (rows.isEmpty()) throw error(HttpStatus.NOT_FOUND, "SERVICE_ORDER_NOT_FOUND", "Заявка на услугу не найдена");
        UUID deliveryId = jdbc.queryForObject("select id from receiving_order where service_order_id = ? and service_role = 'INITIAL_RECEIVING'",
                UUID.class, id);
        List<ServiceShippingOrder> removals = jdbc.query("""
                select sh.id, sh.code, sh.status, (select r.id from receiving_order r where r.source_shipping_order_id = sh.id) as return_id, array_agg(c.code order by c.code) as container_names
                from shipping_order sh
                join shipping_order_source_container link on link.shipping_order_id = sh.id
                join container c on c.id = link.container_id
                where sh.service_order_id = ?
                group by sh.id, sh.code, sh.status order by sh.code
                """, (rs, row) -> new ServiceShippingOrder(rs.getObject("id", UUID.class), rs.getInt("code"),
                        rs.getString("status"), Arrays.stream((Object[]) rs.getArray("container_names").getArray())
                                .map(Object::toString).toList(), rs.getObject("return_id", UUID.class)), id);
        List<ServiceSelectableContainer> selectable = jdbc.query("""
                select distinct c.id, c.code, c.type
                from waybill w
                join waybill_railway_carriage rc on rc.waybill_id = w.id
                join waybill_container wc on wc.waybill_railway_carriage_id = rc.id
                join container c on c.id = wc.container_id
                left join shipping_order_source_container link
                    on link.service_order_id = ? and link.container_id = c.id
                where w.receiving_order_id = ? and c.type = 'STANDARD_20' and link.container_id is null
                order by c.code
                """, (rs, row) -> new ServiceSelectableContainer(rs.getObject("id", UUID.class),
                        rs.getString("code"), rs.getString("type")), id, deliveryId);
        List<ReturnReceivingOrder> returns = jdbc.query("""
                select r.id, r.code, r.status, array_agg(c.code order by c.code) as container_names
                from receiving_order r join receiving_order_container rc on rc.receiving_order_id = r.id
                join container c on c.id = rc.container_id
                where r.service_order_id = ? and r.service_role = 'RETURN_RECEIVING' group by r.id order by r.code
                """, (rs, row) -> new ReturnReceivingOrder(rs.getObject("id", UUID.class), rs.getInt("code"),
                        rs.getString("status"), java.util.Arrays.stream((Object[]) rs.getArray("container_names").getArray()).map(Object::toString).toList()), id);
        return new ServiceOrderDetails(rows.getFirst(), receiving.findById(deliveryId), removals, selectable, returns);
    }

    private static ServiceOrderSummary summary(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ServiceOrderSummary(rs.getObject("id", UUID.class), rs.getInt("code"),
                rs.getObject("client_id", UUID.class), rs.getString("client_name"),
                rs.getObject("contract_id", UUID.class), rs.getString("contract_name"),
                rs.getString("status"), rs.getInt("shipping_count"));
    }

    private static ApiException error(HttpStatus status, String code, String message) {
        return new ApiException(status, code, message);
    }

    private record SourceRow(ServiceOrderCargoPlanner.SourceContainer cargo, String type) {}
    private record ServiceHeader(UUID clientId, UUID contractId, String status) {}
}
