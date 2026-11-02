package ru.billing.app.comprehensiveserviceorder;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
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
public class ComprehensiveServiceOrderService {
    private final JdbcTemplate jdbc;
    private final ReceivingOrderService receiving;
    private final ShippingOrderService shipping;

    public ComprehensiveServiceOrderService(JdbcTemplate jdbc, ReceivingOrderService receiving, ShippingOrderService shipping) {
        this.jdbc = jdbc;
        this.receiving = receiving;
        this.shipping = shipping;
    }

    @Transactional
    public ComprehensiveServiceOrderDetails create(CreateComprehensiveServiceOrderRequest request) {
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
                List.of(), request.waybillIds(), List.of(), FillingType.ALL, List.of(), List.of()).withDefaultContainerOwner(request.defaultContainerOwnerId()));
        UUID id = UUID.randomUUID();
        jdbc.update("insert into comprehensive_service_order(id, code, client_id, contract_id) values (?, ?, ?, ?)",
                id, serviceCode, request.clientId(), request.contractId());
        jdbc.update("update receiving_order set comprehensive_service_order_id = ? where id = ?", id, delivery.id());

        List<SourceRow> sources = loadSources(delivery.id());
        List<OrderContainerRequest> containers = ComprehensiveServiceOrderCargoPlanner.plan(
                sources.stream().map(SourceRow::cargo).toList());
        if (containers.isEmpty()) throw error(HttpStatus.BAD_REQUEST, "COMPREHENSIVE_SERVICE_ORDER_CONTAINERS_REQUIRED",
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
    public ComprehensiveServiceOrderDetails createShippingForTwentyFootContainers(UUID serviceId, List<UUID> containerIds) {
        if (containerIds == null || containerIds.isEmpty() || containerIds.size() > 2
                || containerIds.contains(null) || new LinkedHashSet<>(containerIds).size() != containerIds.size()) {
            throw error(HttpStatus.BAD_REQUEST, "INVALID_CONTAINER_SELECTION", "Выберите один или два разных КТК стандарта 20");
        }
        List<ServiceHeader> services = jdbc.query(
                "select client_id, contract_id, status from comprehensive_service_order where id = ? for update",
                (rs, row) -> new ServiceHeader(rs.getObject("client_id", UUID.class),
                        rs.getObject("contract_id", UUID.class), rs.getString("status")), serviceId);
        if (services.isEmpty()) throw error(HttpStatus.NOT_FOUND, "COMPREHENSIVE_SERVICE_ORDER_NOT_FOUND", "Заявка на услугу не найдена");
        ServiceHeader service = services.getFirst();
        if ("COMPLETED".equals(service.status())) throw error(HttpStatus.CONFLICT, "COMPREHENSIVE_SERVICE_ORDER_COMPLETED",
                "Нельзя создавать заявки на вывоз для выполненной услуги");
        UUID deliveryId = jdbc.queryForObject(
                "select id from receiving_order where comprehensive_service_order_id = ? and service_role = 'INITIAL_RECEIVING'",
                UUID.class, serviceId);
        List<SourceRow> sources = loadSources(deliveryId);
        Map<UUID, String> types = typesByContainer(sources);
        Map<UUID, OrderContainerRequest> planned = new HashMap<>();
        for (OrderContainerRequest container : ComprehensiveServiceOrderCargoPlanner.plan(
                sources.stream().map(SourceRow::cargo).toList())) planned.put(container.containerId(), container);
        List<OrderContainerRequest> selected = new ArrayList<>();
        for (UUID containerId : containerIds) {
            if (!"STANDARD_20".equals(types.get(containerId)) || !planned.containsKey(containerId)) {
                throw error(HttpStatus.BAD_REQUEST, "CONTAINER_NOT_AVAILABLE", "Выберите КТК стандарта 20 из данной поставки");
            }
            Integer assigned = jdbc.queryForObject("select count(*) from shipping_order_source_container "
                    + "where comprehensive_service_order_id = ? and container_id = ?", Integer.class, serviceId, containerId);
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
        containers = containers.stream().map(container -> withWaybillCargo(deliveryId, container)).toList();
        CreatedOrderResponse created = shipping.create(new CreateOrderRequest(clientId, contractId, areaId,
                TransportType.VEHICLE, containers, List.of(), List.of(), FillingType.ALL, List.of(), List.of()));
        jdbc.update("update shipping_order set comprehensive_service_order_id = ?, source_receiving_order_id = ? where id = ?",
                serviceId, deliveryId, created.id());
        for (OrderContainerRequest container : containers) {
            jdbc.update("insert into shipping_order_source_container(shipping_order_id, comprehensive_service_order_id, container_id) "
                    + "values (?, ?, ?)", created.id(), serviceId, container.containerId());
        }
    }

    private OrderContainerRequest withWaybillCargo(UUID deliveryId, OrderContainerRequest container) {
        if (container.empty()) return container;
        record Goods(UUID waybillId, UUID code, java.math.BigDecimal weight) {}
        var goods = jdbc.query("""
                select w.id, p.etsng_code_id,
                       case when (select count(*) from waybill_product where waybill_id=w.id) = 1
                            then wc.net_weight else p.weight end as cargo_weight
                from waybill w join waybill_railway_carriage rc on rc.waybill_id=w.id
                join waybill_container wc on wc.waybill_railway_carriage_id=rc.id
                join waybill_product p on p.waybill_id=w.id
                where w.receiving_order_id=? and wc.container_id=?
                order by w.id, p.etsng_code_id, p.weight, p.id
                """, (rs, row) -> new Goods(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getBigDecimal(3)),
                deliveryId, container.containerId());
        var byWaybill = new LinkedHashMap<UUID, List<CargoRequest>>();
        for (var item : goods) {
            if (item.weight().signum() > 0) byWaybill.computeIfAbsent(item.waybillId(), ignored -> new ArrayList<>())
                    .add(new CargoRequest(item.code(), item.weight()));
        }
        var items = byWaybill.isEmpty() ? List.<CargoRequest>of() : byWaybill.values().iterator().next();
        for (var other : byWaybill.values()) {
            if (other.size() != items.size() || !java.util.stream.IntStream.range(0, items.size()).allMatch(i ->
                    other.get(i).etsngCodeId().equals(items.get(i).etsngCodeId())
                    && other.get(i).weight().compareTo(items.get(i).weight()) == 0)) {
                throw error(HttpStatus.CONFLICT, "CONFLICTING_CONTAINER_CARGO", "У КТК в выбранных накладных различается состав грузов");
            }
        }
        if (items.isEmpty()) throw error(HttpStatus.BAD_REQUEST, "CONTAINER_CARGO_REQUIRED", "У гружёного КТК нет груза с положительной массой");
        return new OrderContainerRequest(container.containerId(), false, items.getFirst(), container.ownerClientId(),
                container.sealNumbers(), container.sealTypeId(), container.hazardClassId(), items);
    }

    private List<SourceRow> loadSources(UUID deliveryId) {
        jdbc.query("""
                select c.id from container c where c.id in (
                    select wc.container_id from waybill_details w
                    join waybill_railway_carriage rc on rc.waybill_id = w.id
                    join waybill_container_details wc on wc.waybill_railway_carriage_id = rc.id
                    where w.receiving_order_id = ?
                ) order by c.id for share
                """, (rs, row) -> rs.getObject("id", UUID.class), deliveryId);
        return jdbc.query("""
                select wc.container_id, wc.weight as gross_weight, wc.net_weight, c.container_type as type, p.etsng_code_id, coalesce(roc.danger_class_id,hazard.danger_class_id) as danger_class_id, null::uuid as owner_container_id, coalesce(roc.seal_numbers,wc.seal_numbers) as seal_numbers, coalesce(roc.seal_type_id,wc.seal_type_id) as seal_type_id
                from waybill_details w
                join waybill_railway_carriage rc on rc.waybill_id = w.id
                join waybill_container_details wc on wc.waybill_railway_carriage_id = rc.id
                join container c on c.id = wc.container_id
                left join receiving_order_container roc on roc.receiving_order_id=w.receiving_order_id and roc.container_id=wc.container_id
                left join lateral (
                    select case when count(distinct dp.danger_class_id)=1 then (array_agg(distinct dp.danger_class_id))[1] end as danger_class_id
                    from waybill_product wp join danger_product dp on dp.id=wp.danger_product_id where wp.waybill_id=w.id
                ) hazard on wc.net_weight>0
                left join lateral (select * from waybill_product_details wp where wp.waybill_id = w.id order by wp.etsng_code_id, wp.id limit 1) p on wc.net_weight > 0
                where w.receiving_order_id = ? order by wc.container_id, wc.id
                """, (rs, row) -> new SourceRow(new ComprehensiveServiceOrderCargoPlanner.SourceContainer(
                        rs.getObject("container_id", UUID.class), rs.getObject("etsng_code_id", UUID.class),
                        rs.getBigDecimal("gross_weight"), rs.getBigDecimal("net_weight"), rs.getObject("owner_container_id", UUID.class), rs.getString("seal_numbers"), rs.getObject("seal_type_id", UUID.class), rs.getObject("danger_class_id", UUID.class)), rs.getString("type")), deliveryId);
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
            select s.id, s.code, s.client_id, c.name as client_name, s.contract_id,
                   ct.name as contract_name, s.status,
                   (select count(*) from shipping_order sh where sh.comprehensive_service_order_id = s.id) as shipping_count
              from comprehensive_service_order s join client c on c.id = s.client_id
              join contract ct on ct.id = s.contract_id
            """;

    @Transactional(readOnly = true)
    public PagedResponse<ComprehensiveServiceOrderSummary> findPage(int requestedPage, int requestedSize) {
        return findPage(requestedPage, requestedSize, "", "");
    }

    @Transactional(readOnly = true)
    public PagedResponse<ComprehensiveServiceOrderSummary> findPage(int requestedPage, int requestedSize, String query, String status) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(1, Math.min(requestedSize, 100));
        long total = jdbc.queryForObject("select count(*) from comprehensive_service_order s join client c on c.id = s.client_id join contract ct on ct.id = s.contract_id where (? = '' or position(lower(?) in lower(concat_ws(' ', s.code::text, c.name, ct.name))) > 0) and (? = '' or s.status = ?)", Long.class, query, query, status, status);
        List<ComprehensiveServiceOrderSummary> items = jdbc.query(SUMMARY_SQL + " where (? = '' or position(lower(?) in lower(concat_ws(' ', s.code::text, c.name, ct.name))) > 0) and (? = '' or s.status = ?) order by s.code desc limit ? offset ?",
                (rs, row) -> summary(rs), query, query, status, status, size, page * size);
        return PagedResponse.of(items, page, size, total);
    }

    @Transactional(readOnly = true)
    public ComprehensiveServiceOrderDetails findById(UUID id) {
        List<ComprehensiveServiceOrderSummary> rows = jdbc.query(SUMMARY_SQL + " where s.id = ?", (rs, row) -> summary(rs), id);
        if (rows.isEmpty()) throw error(HttpStatus.NOT_FOUND, "COMPREHENSIVE_SERVICE_ORDER_NOT_FOUND", "Заявка на услугу не найдена");
        UUID deliveryId = jdbc.queryForObject("select id from receiving_order where comprehensive_service_order_id = ? and service_role = 'INITIAL_RECEIVING'",
                UUID.class, id);
        List<ServiceShippingOrder> removals = jdbc.query("""
                select sh.id, sh.number as code, sh.order_status as status, (select r.id from receiving_order r where r.source_shipping_order_id = sh.id) as return_id, array_agg(c.code order by c.code) as container_names
                from shipping_order sh
                join shipping_order_source_container link on link.shipping_order_id = sh.id
                join container c on c.id = link.container_id
                where sh.comprehensive_service_order_id = ?
                group by sh.id, sh.number, sh.order_status order by sh.number
                """, (rs, row) -> new ServiceShippingOrder(rs.getObject("id", UUID.class), rs.getInt("code"),
                        rs.getString("status"), Arrays.stream((Object[]) rs.getArray("container_names").getArray())
                                .map(Object::toString).toList(), rs.getObject("return_id", UUID.class)), id);
        List<ServiceSelectableContainer> selectable = jdbc.query("""
                select distinct c.id, c.code, c.container_type as type
                from waybill_details w
                join waybill_railway_carriage rc on rc.waybill_id = w.id
                join waybill_container_details wc on wc.waybill_railway_carriage_id = rc.id
                join container c on c.id = wc.container_id
                left join shipping_order_source_container link
                    on link.comprehensive_service_order_id = ? and link.container_id = c.id
                where w.receiving_order_id = ? and c.container_type = 'STANDARD_20' and link.container_id is null
                order by c.code
                """, (rs, row) -> new ServiceSelectableContainer(rs.getObject("id", UUID.class),
                        rs.getString("code"), rs.getString("type")), id, deliveryId);
        List<ReturnReceivingOrder> returns = jdbc.query("""
                select r.id, r.number as code, r.order_status as status, array_agg(c.code order by c.code) as container_names
                from receiving_order r join receiving_order_container rc on rc.receiving_order_id = r.id
                join container c on c.id = rc.container_id
                where r.comprehensive_service_order_id = ? and r.service_role = 'RETURN_RECEIVING' group by r.id order by r.number
                """, (rs, row) -> new ReturnReceivingOrder(rs.getObject("id", UUID.class), rs.getInt("code"),
                        rs.getString("status"), java.util.Arrays.stream((Object[]) rs.getArray("container_names").getArray()).map(Object::toString).toList()), id);
        return new ComprehensiveServiceOrderDetails(rows.getFirst(), receiving.findById(deliveryId), removals, selectable, returns, progress(id, deliveryId));
    }

    private ServiceProgress progress(UUID serviceId, UUID deliveryId) {
        return jdbc.queryForObject("""
                with initial_containers as (
                    select distinct wc.container_id from waybill_details w
                    join waybill_railway_carriage rc on rc.waybill_id = w.id
                    join waybill_container_details wc on wc.waybill_railway_carriage_id = rc.id
                    where w.receiving_order_id = ?
                ), shipping as (
                    select link.container_id, sh.order_status as status, sh.id from shipping_order sh
                    join shipping_order_source_container link on link.shipping_order_id = sh.id
                    join initial_containers ic on ic.container_id = link.container_id
                    where sh.comprehensive_service_order_id = ?
                ), returns as (
                    select rc.container_id, r.order_status as status, r.id from receiving_order r
                    join receiving_order_container rc on rc.receiving_order_id = r.id
                    join shipping sh on sh.id = r.source_shipping_order_id and sh.container_id = rc.container_id
                    where r.comprehensive_service_order_id = ? and r.service_role = 'RETURN_RECEIVING'
                )
                select a.name as initial_name, b.name as return_name,
                    case when initial.order_status = 'COMPLETED'
                        then coalesce(initial.accepted_container_count, (select count(*) from initial_containers))
                        else 0 end as accepted,
                    (select count(distinct container_id) from shipping) as shipping_created,
                    (select count(distinct container_id) from shipping where status = 'COMPLETED') as shipping_completed,
                    (select count(distinct container_id) from returns) as return_created,
                    (select count(distinct container_id) from returns where status = 'COMPLETED') as return_completed,
                    coalesce(initial.accepted_container_count, (select count(*) from initial_containers)) as total,
                    (select count(*) from initial_containers ic where not exists
                        (select 1 from shipping sh where sh.container_id = ic.container_id)) as shipping_missing,
                    (select count(distinct id) from shipping) as shipping_order_count,
                    (select count(distinct id) from shipping where status = 'COMPLETED') as shipping_orders_completed,
                    (select count(distinct id) from returns) as return_order_count,
                    (select count(distinct id) from returns where status = 'COMPLETED') as return_orders_completed
                from receiving_order initial
                left join complex_service_catalog a on
                    (initial.a_complex_service_id is not null and a.id = initial.a_complex_service_id)
                    or (initial.a_complex_service_id is null and a.purpose =
                        case when (select count(*) from initial_containers) >= 40 then 'A_TRAIN' else 'A_WAGON' end)
                left join complex_service_catalog b on b.purpose = 'B_AUTO_RETURN'
                where initial.id = ?
                """, (rs, row) -> new ServiceProgress(rs.getString("initial_name"), rs.getString("return_name"),
                        rs.getInt("accepted"), rs.getInt("shipping_created"), rs.getInt("shipping_completed"),
                        rs.getInt("return_created"), rs.getInt("return_completed"),
                        rs.getInt("total"), rs.getInt("shipping_missing"),
                        rs.getInt("shipping_order_count"), rs.getInt("shipping_orders_completed"),
                        rs.getInt("return_order_count"), rs.getInt("return_orders_completed")),
                deliveryId, serviceId, serviceId, deliveryId);
    }

    private static ComprehensiveServiceOrderSummary summary(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ComprehensiveServiceOrderSummary(rs.getObject("id", UUID.class), rs.getInt("code"),
                rs.getObject("client_id", UUID.class), rs.getString("client_name"),
                rs.getObject("contract_id", UUID.class), rs.getString("contract_name"),
                rs.getString("status"), rs.getInt("shipping_count"));
    }

    private static ApiException error(HttpStatus status, String code, String message) {
        return new ApiException(status, code, message);
    }

    private record SourceRow(ComprehensiveServiceOrderCargoPlanner.SourceContainer cargo, String type) {}
    private record ServiceHeader(UUID clientId, UUID contractId, String status) {}
}
