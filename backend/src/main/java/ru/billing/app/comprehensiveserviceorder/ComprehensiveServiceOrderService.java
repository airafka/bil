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
    private final ServiceTariffSnapshot tariffs;

    public ComprehensiveServiceOrderService(JdbcTemplate jdbc, ReceivingOrderService receiving, ShippingOrderService shipping, ServiceTariffSnapshot tariffs) {
        this.jdbc = jdbc;
        this.receiving = receiving;
        this.shipping = shipping;
        this.tariffs = tariffs;
    }

    @Transactional
    public ComprehensiveServiceOrderDetails create(CreateComprehensiveServiceOrderRequest request) {
        if (request.clientId() == null || request.contractId() == null) {
            throw error(HttpStatus.BAD_REQUEST, "CLIENT_CONTRACT_REQUIRED", "Выберите клиента и договор");
        }
        if (request.containerOwners().stream().map(CreateComprehensiveServiceOrderRequest.ContainerOwner::containerId).distinct().count() != request.containerOwners().size()) {
            throw error(HttpStatus.BAD_REQUEST, "DUPLICATE_CONTAINER", "Собственник КТК указан несколько раз");
        }
        validateServiceWaybills(request.complexServiceId(), request.waybillIds());
        List<UUID> areas = jdbc.query("select id from terminal_area_catalog where code = 'CONTAINER'",
                (rs, row) -> rs.getObject("id", UUID.class));
        if (areas.isEmpty()) throw error(HttpStatus.NOT_FOUND, "TERMINAL_AREA_NOT_FOUND", "Контейнерная площадка не найдена");
        UUID areaId = areas.getFirst();
        Integer serviceCode = jdbc.queryForObject("select nextval('comprehensive_service_order_number_seq')", Integer.class);
        CreatedOrderResponse delivery = receiving.create(new CreateOrderRequest(
                request.clientId(), request.contractId(), areaId, TransportType.RAILWAY,
                List.of(), request.waybillIds(), List.of(), FillingType.ALL, List.of(), List.of()).withDefaultContainerOwner(request.defaultContainerOwnerId()));
        if (!request.containerOwners().isEmpty()) {
            receiving.updateContainerAttributes(delivery.id(), new UpdateOrderContainersRequest(request.containerOwners().stream()
                    .map(owner -> new UpdateOrderContainersRequest.Attributes(owner.containerId(), owner.ownerClientId(), null, null, null)).toList()));
        }
        UUID id = UUID.randomUUID();
        jdbc.update("insert into comprehensive_service_order(id, code, client_id, contract_id, selected_complex_service_id) values (?, ?, ?, ?, ?)",
                id, serviceCode, request.clientId(), request.contractId(), request.complexServiceId());
        jdbc.update("update receiving_order set comprehensive_service_order_id = ? where id = ?", id, delivery.id());

        List<SourceRow> sources = loadSources(delivery.id());
        List<OrderContainerRequest> containers = ComprehensiveServiceOrderCargoPlanner.plan(
                sources.stream().map(SourceRow::cargo).toList());
        if (containers.isEmpty()) throw error(HttpStatus.BAD_REQUEST, "COMPREHENSIVE_SERVICE_ORDER_CONTAINERS_REQUIRED",
                "В выбранных накладных нет КТК для вывоза");
        tariffs.fix(id, request.clientId(), request.contractId(), request.complexServiceId());
        Map<UUID, String> types = typesByContainer(sources);
        for (OrderContainerRequest container : containers) {
            String type = requireType(types, container.containerId());
            if ("STANDARD_40".equals(type)) {
                createShipping(id, delivery.id(), request.clientId(), request.contractId(), areaId, List.of(container));
            }
        }
        return findById(id);
    }

    public record AvailableService(UUID id, String name, Integer minWaybillContainers, Integer maxWaybillContainers) {
        boolean accepts(long count) {
            return (minWaybillContainers == null || count >= minWaybillContainers)
                    && (maxWaybillContainers == null || count <= maxWaybillContainers);
        }
    }

    @Transactional(readOnly = true)
    public List<AvailableService> availableServices() {
        return jdbc.query("select id,name,min_waybill_containers,max_waybill_containers from complex_service_catalog where order_workflow='RAILWAY_RETURN' order by name",
                (rs,n)->new AvailableService(rs.getObject(1,UUID.class),rs.getString(2),
                        rs.getObject(3,Integer.class),rs.getObject(4,Integer.class)));
    }

    private void validateServiceWaybills(UUID serviceId, List<UUID> waybillIds) {
        var options = availableServices();
        var selected = options.stream().filter(option -> option.id().equals(serviceId)).findFirst()
                .orElseThrow(() -> error(HttpStatus.BAD_REQUEST, "SERVICE_NOT_AVAILABLE", "Выберите доступную комплексную услугу"));
        if (waybillIds == null || waybillIds.isEmpty())
            throw error(HttpStatus.BAD_REQUEST, "WAYBILLS_REQUIRED", "Выберите хотя бы одну накладную");
        record WaybillCount(String number, long count) {}
        for (UUID waybillId : new LinkedHashSet<>(waybillIds)) {
            var bills = jdbc.query("""
                    select w.number, count(wc.id) as container_count from waybill w
                    left join waybill_railway_carriage rc on rc.waybill_id=w.id
                    left join waybill_container wc on wc.waybill_railway_carriage_id=rc.id
                    where w.id=? group by w.id,w.number
                    """, (rs,n)->new WaybillCount(rs.getString("number"),rs.getLong("container_count")), waybillId);
            if (bills.isEmpty()) throw error(HttpStatus.BAD_REQUEST, "WAYBILL_NOT_FOUND", "Выбранная накладная не найдена");
            var bill = bills.getFirst();
            if (!selected.accepts(bill.count())) {
                String recommendation = options.stream().filter(option -> option.accepts(bill.count()))
                        .map(option -> "Необходимо выбрать услугу «" + option.name() + "».").findFirst()
                        .orElse("Выберите другую накладную.");
                throw error(HttpStatus.BAD_REQUEST, "SERVICE_WAYBILL_CONTAINER_COUNT_MISMATCH",
                        "В накладной №" + bill.number() + " — " + bill.count() + " КТК. "
                                + "Количество КТК не соответствует выбранной услуге. " + recommendation);
            }
        }
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
                select wc.container_id, wc.weight as gross_weight, wc.net_weight, c.container_type as type, p.etsng_code_id, hazard.danger_class_id as danger_class_id, null::uuid as owner_container_id, wc.seal_numbers as seal_numbers, wc.seal_type_id as seal_type_id
                from waybill_details w
                join waybill_railway_carriage rc on rc.waybill_id = w.id
                join waybill_container_details wc on wc.waybill_railway_carriage_id = rc.id
                join container c on c.id = wc.container_id
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
                   ct.name as contract_name, s.status, s.created_at, s.workflow, s.source_service_order_id,
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
        UUID deliveryId = jdbc.queryForObject("select id from receiving_order where comprehensive_service_order_id = ? order by case when service_role='INITIAL_RECEIVING' then 0 else 1 end, number limit 1",
                UUID.class, id);
        List<ServiceShippingOrder> removals = jdbc.query("""
                select sh.id, sh.number as code, sh.order_status as status, sh.planned_shipping_date_time, (select name from client_related_entity where id=sh.consignee_id) as consignee, array_agg(c.code order by c.code) as container_names
                from shipping_order sh
                join shipping_order_source_container link on link.shipping_order_id = sh.id
                join container c on c.id = link.container_id
                where sh.comprehensive_service_order_id = ?
                group by sh.id, sh.number, sh.order_status order by sh.number
                """, (rs, row) -> new ServiceShippingOrder(rs.getObject("id", UUID.class), rs.getInt("code"),
                        rs.getString("status"), Arrays.stream((Object[]) rs.getArray("container_names").getArray())
                                .map(Object::toString).toList(), rs.getObject("planned_shipping_date_time", java.time.LocalDateTime.class), rs.getString("consignee")), id);
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
        List<ReturnReceivingOrder> returns = ReturnReceivingOrder.find(jdbc,
                "r.comprehensive_service_order_id=? or sh.comprehensive_service_order_id=?", id, id);
        var totals = jdbc.queryForMap("""
                select coalesce(sum(b.amount_without_vat),0) as without_vat,
                       coalesce(sum(b.amount_with_vat),0) as with_vat
                from billing_charge b join service_execution e on e.id=b.service_execution_id
                where e.comprehensive_service_order_id=?
                """, id);
        return new ComprehensiveServiceOrderDetails(rows.getFirst(), receiving.findById(deliveryId), removals, selectable, returns, "AUTO_RETURN".equals(rows.getFirst().workflow()) ? autoProgress(id) : progress(id, deliveryId),
                (java.math.BigDecimal) totals.get("without_vat"), (java.math.BigDecimal) totals.get("with_vat"));
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
                    where r.service_role = 'RETURN_RECEIVING'
                )
                select selected.name as service_name,
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
                join comprehensive_service_order parent on parent.id=initial.comprehensive_service_order_id
                join complex_service_catalog selected on selected.id=parent.selected_complex_service_id
                where initial.id = ?
                """, (rs, row) -> new ServiceProgress(rs.getString("service_name"),
                        rs.getInt("accepted"), rs.getInt("shipping_created"), rs.getInt("shipping_completed"),
                        rs.getInt("return_created"), rs.getInt("return_completed"),
                        rs.getInt("total"), rs.getInt("shipping_missing"),
                        rs.getInt("shipping_order_count"), rs.getInt("shipping_orders_completed"),
                        rs.getInt("return_order_count"), rs.getInt("return_orders_completed")),
                deliveryId, serviceId, deliveryId);
    }

    private ServiceProgress autoProgress(UUID id) {
        return jdbc.queryForObject("""
            select c.name, count(rc.id) as total,
                   count(rc.id) filter(where r.order_status='COMPLETED') as completed,
                   count(distinct r.id) as orders,
                   count(distinct r.id) filter(where r.order_status='COMPLETED') as done
            from comprehensive_service_order s join complex_service_catalog c on c.id=s.selected_complex_service_id
            join receiving_order r on r.comprehensive_service_order_id=s.id
            join receiving_order_container rc on rc.receiving_order_id=r.id
            where s.id=? group by c.name
            """,(rs,n)->new ServiceProgress(rs.getString("name"),0,0,0,rs.getInt("total"),rs.getInt("completed"),
            rs.getInt("total"),0,0,0,rs.getInt("orders"),rs.getInt("done")),id);
    }

    private static ComprehensiveServiceOrderSummary summary(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ComprehensiveServiceOrderSummary(rs.getObject("id", UUID.class), rs.getInt("code"),
                rs.getObject("client_id", UUID.class), rs.getString("client_name"),
                rs.getObject("contract_id", UUID.class), rs.getString("contract_name"),
                rs.getString("status"), rs.getInt("shipping_count"), rs.getObject("created_at", java.time.OffsetDateTime.class), rs.getString("workflow"), rs.getObject("source_service_order_id", UUID.class));
    }

    private static ApiException error(HttpStatus status, String code, String message) {
        return new ApiException(status, code, message);
    }

    private record SourceRow(ComprehensiveServiceOrderCargoPlanner.SourceContainer cargo, String type) {}
    private record ServiceHeader(UUID clientId, UUID contractId, String status) {}
}
