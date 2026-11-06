package ru.billing.app.comprehensiveserviceorder;

import java.util.List;
import java.util.UUID;
import java.util.HashSet;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.*;

@Service
public class ReturnReceivingService {
    private final JdbcTemplate jdbc;
    private final ReceivingOrderService receiving;
    private final ServiceTariffSnapshot tariffs;

    public ReturnReceivingService(JdbcTemplate jdbc, ReceivingOrderService receiving, ServiceTariffSnapshot tariffs) {
        this.jdbc = jdbc;
        this.receiving = receiving;
        this.tariffs = tariffs;
    }

    @Transactional
    public ReturnResult create(UUID shippingId, CreateReturnRequest request) {
        return create(shippingId, request, null);
    }

    private ReturnResult create(UUID shippingId, CreateReturnRequest request, UUID sharedParentId) {
        List<UUID> containerIds=request.containerIds();
        jdbc.query("select s.id from comprehensive_service_order s join shipping_order sh on sh.comprehensive_service_order_id=s.id where sh.id=? for update of s", (rs,n)->rs.getObject(1,UUID.class),shippingId);
        var sources = jdbc.query("""
                select id, comprehensive_service_order_id, client_id, contract_id, terminal_area_catalog_id
                  from shipping_order where id = ? for update
                """, (rs, row) -> new Source(rs.getObject("comprehensive_service_order_id", UUID.class),
                        rs.getObject("client_id", UUID.class), rs.getObject("contract_id", UUID.class),
                        rs.getObject("terminal_area_catalog_id", UUID.class)), shippingId);
        if (sources.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "SHIPPING_ORDER_NOT_FOUND", "Заявка на вывоз не найдена");
        Source source = sources.getFirst();
        if (source.serviceId() == null) throw new ApiException(HttpStatus.BAD_REQUEST, "SERVICE_SHIPPING_REQUIRED", "Возврат доступен только для вывоза в заявке на услугу");
        Boolean railway = jdbc.queryForObject("select workflow='RAILWAY_RETURN' from comprehensive_service_order where id=?", Boolean.class, source.serviceId());
        if (!Boolean.TRUE.equals(railway)) throw new ApiException(HttpStatus.BAD_REQUEST,"RAILWAY_SERVICE_REQUIRED","Возврат доступен для вывоза исходной ЖД-услуги");
        UUID clientId = request.useCurrentClient() ? source.clientId() : request.clientId();
        UUID contractId = request.useCurrentClient() ? source.contractId() : request.contractId();
        if(clientId==null || contractId==null) throw new ApiException(HttpStatus.BAD_REQUEST,"CLIENT_CONTRACT_REQUIRED","Выберите клиента и договор");
        if(Boolean.FALSE.equals(jdbc.queryForObject("select exists(select 1 from contract where id=? and client_id=?)",Boolean.class,contractId,clientId)))
            throw new ApiException(HttpStatus.BAD_REQUEST,"CONTRACT_CLIENT_MISMATCH","Договор не принадлежит выбранному клиенту");
        boolean separate = !clientId.equals(source.clientId()) || !contractId.equals(source.contractId());
        var ids = new HashSet<UUID>();
        for (UUID containerId : containerIds) {
            if(Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from receiving_order_container where source_shipping_order_id=? and container_id=?)",Boolean.class,shippingId,containerId)))
                throw new ApiException(HttpStatus.CONFLICT,"RETURN_ALREADY_EXISTS","Для выбранного КТК уже создан возврат. Обновите заявку.");
            if (!ids.add(containerId)) throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_CONTAINER", "КТК указан повторно");
        Integer linked = jdbc.queryForObject("select count(*) from shipping_order_source_container where shipping_order_id = ? and container_id = ?",
                Integer.class, shippingId, containerId);
        if (linked == null || linked == 0) throw new ApiException(HttpStatus.BAD_REQUEST, "CONTAINER_NOT_IN_SHIPPING", "КТК не относится к этому вывозу");
        }
        var returnContainers = new java.util.ArrayList<OrderContainerRequest>();
        for (UUID containerId : containerIds) {
            var rows = jdbc.query("""
                    select distinct case when s.order_status = 'DRAFT' then coalesce(wc.owner_container_id, r.default_container_owner_id) else sc.owner_container_id end as owner_container_id,
                           sc.seal_numbers, sc.seal_type_id, sc.danger_class_id
                    from shipping_order_container sc join shipping_order s on s.id=sc.shipping_order_id
                    left join receiving_order r on r.id=s.source_receiving_order_id
                        and r.comprehensive_service_order_id=s.comprehensive_service_order_id and r.service_role='INITIAL_RECEIVING'
                    left join waybill w on w.receiving_order_id=r.id
                    left join waybill_railway_carriage rc on rc.waybill_id=w.id
                    left join waybill_container wc on wc.waybill_railway_carriage_id=rc.id and wc.container_id=sc.container_id
                    where sc.shipping_order_id=? and sc.container_id=? and (s.order_status<>'DRAFT' or wc.container_id is not null)
                    """,
                    (rs, row) -> new OrderContainerRequest(containerId, true, null,
                            rs.getObject("owner_container_id", UUID.class), rs.getString("seal_numbers"),
                            rs.getObject("seal_type_id", UUID.class), rs.getObject("danger_class_id", UUID.class)), shippingId, containerId);
            if (rows.size() > 1) throw new ApiException(HttpStatus.CONFLICT, "RETURN_OWNER_AMBIGUOUS", "В исходной поставке для КТК указаны разные собственники");
            if (rows.size() != 1) throw new ApiException(HttpStatus.BAD_REQUEST, "CONTAINER_NOT_IN_SHIPPING", "КТК отсутствует в составе вывоза");
            if (rows.getFirst().ownerClientId() == null) {
                throw new ApiException(HttpStatus.CONFLICT, "RETURN_OWNER_REQUIRED",
                    "Укажите собственника КТК в исходной поставке КП-ЖД");
            }
            returnContainers.add(rows.getFirst());
        }
        UUID parentId=source.serviceId();
        if(separate && sharedParentId != null) parentId = sharedParentId;
        if(separate && sharedParentId == null) {
            var services=jdbc.query("select id from complex_service_catalog where order_workflow='AUTO_RETURN' for share",(rs,n)->rs.getObject(1,UUID.class));
            if(services.size()!=1) throw new ApiException(HttpStatus.CONFLICT,"AUTO_RETURN_SERVICE_REQUIRED","Услуга приёма автотранспортом недоступна");
            parentId=UUID.randomUUID();
            jdbc.update("insert into comprehensive_service_order(id,code,client_id,contract_id,selected_complex_service_id,workflow,source_service_order_id) values (?,nextval('comprehensive_service_order_number_seq'),?,?,?,'AUTO_RETURN',?)",parentId,clientId,contractId,services.getFirst(),source.serviceId());
            tariffs.fix(parentId,clientId,contractId,services.getFirst());
        }
        CreatedOrderResponse created = receiving.create(new CreateOrderRequest(clientId, contractId, source.areaId(),
                TransportType.VEHICLE, returnContainers, List.of(), List.of(), FillingType.ALL, List.of(), List.of())
                .withDefaultContainerOwner(returnContainers.getFirst().ownerClientId()));
        jdbc.update("""
                update receiving_order set comprehensive_service_order_id = ?, service_role = 'RETURN_RECEIVING',
                    source_shipping_order_id = ? where id = ?
                """, parentId, shippingId, created.id());
        jdbc.update("update receiving_order_container set source_shipping_order_id=? where receiving_order_id=?",shippingId,created.id());
        Integer parentCode=jdbc.queryForObject("select code from comprehensive_service_order where id=?",Integer.class,parentId);
        return new ReturnResult(created.id(),created.code(),parentId,parentCode,separate);
    }

    public record ReturnResult(UUID receivingOrderId,int receivingOrderCode,UUID serviceOrderId,int serviceOrderCode,boolean createdService) {}
    public record CreateReturnRequest(
        @jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=1) List<@jakarta.validation.constraints.NotNull UUID> containerIds,
        @jakarta.validation.constraints.NotNull Boolean useCurrentClient, UUID clientId, UUID contractId) {}
    public record TariffContract(UUID clientId,String clientName,UUID contractId,String contractName) {}
    @Transactional(readOnly=true)
    public List<TariffContract> contracts() {
        return jdbc.query("""
            select t.client_id,cl.name,t.contract_id,ct.name from complex_service_tariff t
            join complex_service_catalog c on c.id=t.complex_service_id
            join client cl on cl.id=t.client_id join contract ct on ct.id=t.contract_id
            where c.order_workflow='AUTO_RETURN' and t.active order by cl.name,ct.name
            """,(rs,n)->new TariffContract(rs.getObject(1,UUID.class),rs.getString(2),rs.getObject(3,UUID.class),rs.getString(4)));
    }


    public record ReturnCandidate(UUID containerId, String containerName, UUID shippingOrderId, int shippingOrderCode) {}
    public record CreateBulkReturnsRequest(
        @jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=10000)
        List<@jakarta.validation.constraints.NotNull UUID> containerIds,
        @jakarta.validation.constraints.NotNull Boolean useCurrentClient, UUID clientId, UUID contractId) {}
    public record BulkReturnResult(UUID serviceOrderId, int serviceOrderCode, boolean createdService, List<ReturnResult> returns) {}

    private void requireRailwayService(UUID serviceId) {
        var workflows = jdbc.query("select workflow from comprehensive_service_order where id=?", (rs,n)->rs.getString(1), serviceId);
        if (workflows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Заявка на услугу не найдена");
        if (!"RAILWAY_RETURN".equals(workflows.getFirst())) throw new ApiException(HttpStatus.BAD_REQUEST,
                "RAILWAY_SERVICE_REQUIRED", "Выберите исходную ЖД-услугу для создания возвратов");
    }

    @Transactional(readOnly = true)
    public List<ReturnCandidate> candidates(UUID serviceId) {
        requireRailwayService(serviceId);
        return jdbc.query("""
            select c.id,c.code,sh.id as shipping_id,sh.number
            from shipping_order_source_container link
            join shipping_order sh on sh.id=link.shipping_order_id
            join container c on c.id=link.container_id
            where link.comprehensive_service_order_id=? and not exists (
                select 1 from receiving_order_container rc
                where rc.source_shipping_order_id=sh.id and rc.container_id=c.id)
            order by sh.number,c.code,c.id
            """, (rs,n)->new ReturnCandidate(rs.getObject(1,UUID.class),rs.getString(2),rs.getObject(3,UUID.class),rs.getInt(4)),serviceId);
    }

    @Transactional
    public BulkReturnResult createForService(UUID serviceId, CreateBulkReturnsRequest request) {
        // Serialize the entire batch with individual returns and lifecycle operations.
        ServiceOrderLock.lock(jdbc,serviceId);
        requireRailwayService(serviceId);
        var selected = new HashSet<>(request.containerIds());
        if (selected.size() != request.containerIds().size()) throw new ApiException(HttpStatus.BAD_REQUEST,
                "DUPLICATE_CONTAINER", "КТК указан повторно");
        var available = candidates(serviceId).stream().filter(row -> selected.contains(row.containerId())).toList();
        if (available.size() != selected.size()) throw new ApiException(HttpStatus.CONFLICT,
                "RETURN_CONTAINERS_UNAVAILABLE", "Часть КТК уже возвращается или не относится к вывозам этой услуги. Обновите список.");
        var results = new java.util.ArrayList<ReturnResult>();
        UUID sharedParent = null;
        for (var row : available) {
            var result = create(row.shippingOrderId(), new CreateReturnRequest(List.of(row.containerId()),
                    request.useCurrentClient(),request.clientId(),request.contractId()), sharedParent);
            results.add(result);
            sharedParent = result.serviceOrderId();
        }
        var first = results.getFirst();
        return new BulkReturnResult(first.serviceOrderId(),first.serviceOrderCode(),first.createdService(),List.copyOf(results));
    }

    private record Source(UUID serviceId, UUID clientId, UUID contractId, UUID areaId) {}
}
