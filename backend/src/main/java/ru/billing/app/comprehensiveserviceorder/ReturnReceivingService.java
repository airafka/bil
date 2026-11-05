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

    public ReturnReceivingService(JdbcTemplate jdbc, ReceivingOrderService receiving) {
        this.jdbc = jdbc;
        this.receiving = receiving;
    }

    @Transactional
    public CreatedOrderResponse create(UUID shippingId, List<UUID> containerIds) {
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
        var existing = jdbc.query("select id, number as code, order_status as status from receiving_order where source_shipping_order_id = ?",
                (rs, row) -> new CreatedOrderResponse(rs.getObject("id", UUID.class), rs.getInt("code"), rs.getString("status")), shippingId);
        if (!existing.isEmpty()) return existing.getFirst();
        var ids = new HashSet<UUID>();
        for (UUID containerId : containerIds) {
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
        CreatedOrderResponse created = receiving.create(new CreateOrderRequest(source.clientId(), source.contractId(), source.areaId(),
                TransportType.VEHICLE, returnContainers, List.of(), List.of(), FillingType.ALL, List.of(), List.of())
                .withDefaultContainerOwner(returnContainers.getFirst().ownerClientId()));
        jdbc.update("""
                update receiving_order set comprehensive_service_order_id = ?, service_role = 'RETURN_RECEIVING',
                    source_shipping_order_id = ? where id = ?
                """, source.serviceId(), shippingId, created.id());
        return created;
    }

    private record Source(UUID serviceId, UUID clientId, UUID contractId, UUID areaId) {}
}
