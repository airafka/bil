package ru.billing.app.billing;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ru.billing.app.error.ApiException;

@Service
public class BillingService {
    private final JdbcTemplate jdbc;

    public BillingService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // Runs inside the order lifecycle transaction, after the stock operation.
    @Transactional(propagation = Propagation.MANDATORY)
    public void complete(String resource, UUID orderId) {
        switch (resource) {
            case "shipping-orders" -> requireInitialReceivingCompleted(orderId);
            case "receiving-orders" -> completeReceiving(orderId);
            case "comprehensive-service-orders" -> { }
            default -> throw new IllegalArgumentException("Unsupported billing resource: " + resource);
        }
    }

    private void requireInitialReceivingCompleted(UUID shippingId) {
        Boolean ready = jdbc.queryForObject("""
                select sh.comprehensive_service_order_id is null or exists (
                    select 1 from receiving_order r where r.id=sh.source_receiving_order_id
                      and r.service_role='INITIAL_RECEIVING' and r.order_status='COMPLETED')
                from shipping_order sh where sh.id=?
                """, Boolean.class, shippingId);
        if (!Boolean.TRUE.equals(ready))
            throw error("INITIAL_RECEIVING_NOT_COMPLETED", "Сначала выполните первоначальную поставку ЖД");
    }

    private void completeReceiving(UUID orderId) {
        var receiving = jdbc.query("""
                select r.comprehensive_service_order_id, r.service_role, r.source_shipping_order_id,
                       s.selected_complex_service_id
                from receiving_order r left join comprehensive_service_order s on s.id=r.comprehensive_service_order_id
                where r.id=?
                """, (rs, n) -> new Receiving(rs.getObject(1, UUID.class), rs.getString(2),
                        rs.getObject(3, UUID.class), rs.getObject(4, UUID.class)), orderId).getFirst();
        if (receiving.serviceId() == null) return;
        if ("INITIAL_RECEIVING".equals(receiving.role())) {
            jdbc.update("""
                    update receiving_order set accepted_container_count=(
                        select count(distinct wc.container_id) from waybill_details w
                        join waybill_railway_carriage rc on rc.waybill_id=w.id
                        join waybill_container_details wc on wc.waybill_railway_carriage_id=rc.id
                        where w.receiving_order_id=?), acceptance_fixed_at=current_timestamp where id=?
                    """, orderId, orderId);
            return;
        }
        if (!"RETURN_RECEIVING".equals(receiving.role()))
            throw error("INVALID_SERVICE_RECEIVING_ROLE", "Неизвестный этап поставки в заявке на услугу");
        String status = jdbc.queryForObject("select order_status from shipping_order where id=? for share",
                String.class, receiving.shippingId());
        if (!"COMPLETED".equals(status))
            throw error("SOURCE_SHIPPING_NOT_COMPLETED", "Сначала выполните исходный вывоз");
        var containers = jdbc.query("select container_id from receiving_order_container where receiving_order_id=? order by container_id",
                (rs, n) -> rs.getObject(1, UUID.class), orderId);
        var original = jdbc.queryForObject("""
            select s.id,s.selected_complex_service_id from shipping_order sh
            join comprehensive_service_order s on s.id=sh.comprehensive_service_order_id where sh.id=?
            """,(rs,n)->new Receiving(rs.getObject(1,UUID.class),"RETURN_RECEIVING",receiving.shippingId(),rs.getObject(2,UUID.class)),receiving.shippingId());
        for (UUID container : containers) {
            charge(original, container, orderId);
            if(!original.serviceId().equals(receiving.serviceId())) charge(receiving, container, orderId);
        }
    }

    private void charge(Receiving receiving, UUID container, UUID orderId) {
        // The immutable creation-time tariff is the only source of prices.
        // One execution per parent/container also makes repeated completion idempotent.
        jdbc.update("""
                insert into service_execution(id,comprehensive_service_order_id,container_id,complex_service_id,
                    receiving_order_id,shipping_order_id,status,performed_at,tariff_id,coefficient,
                    base_price_without_vat,base_price_with_vat,price_without_vat,price_with_vat,priced_at)
                select ?,t.comprehensive_service_order_id,?,t.complex_service_id,?,?,'PERFORMED',current_timestamp,
                    t.tariff_id,t.coefficient,t.base_price_without_vat,t.base_price_with_vat,
                    t.price_without_vat,t.price_with_vat,current_timestamp
                from comprehensive_service_order_tariff t
                where t.comprehensive_service_order_id=? and t.complex_service_id=?
                on conflict(comprehensive_service_order_id,container_id) do nothing
                """, UUID.randomUUID(), container, orderId, receiving.shippingId(), receiving.serviceId(), receiving.catalogId());
        var executions = jdbc.query("""
                select id from service_execution where comprehensive_service_order_id=? and container_id=? for update
                """, (rs, n) -> rs.getObject(1, UUID.class), receiving.serviceId(), container);
        if (executions.isEmpty())
            throw error("TARIFF_SNAPSHOT_NOT_FOUND", "В заявке не зафиксирован тариф выбранной услуги");
        jdbc.update("""
                insert into billing_charge(id,service_execution_id,client_id,contract_id,performed_at,quantity,
                    price_without_vat,amount_without_vat,price_with_vat,amount_with_vat,currency)
                select ?,e.id,s.client_id,s.contract_id,e.performed_at,1,e.price_without_vat,e.price_without_vat,
                    e.price_with_vat,e.price_with_vat,'RUB'
                from service_execution e join comprehensive_service_order s on s.id=e.comprehensive_service_order_id
                where e.id=? on conflict(service_execution_id) do nothing
                """, UUID.randomUUID(), executions.getFirst());
    }

    private static ApiException error(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    private record Receiving(UUID serviceId, String role, UUID shippingId, UUID catalogId) { }
}
