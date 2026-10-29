package ru.billing.app.billing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
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

    public static String purposeForCount(int count) {
        if (count < 1) throw error("EMPTY_ACCEPTED_COMPOSITION", "В первоначальной поставке нет КТК");
        return count >= 40 ? "A_TRAIN" : "A_WAGON";
    }
    public static BigDecimal price(BigDecimal base, BigDecimal coefficient) {
        return base.multiply(coefficient).setScale(2, RoundingMode.HALF_UP);
    }

    // Called only by the transactional status operation, never by reads.
    @Transactional(propagation = Propagation.MANDATORY)
    public void complete(String resource, UUID orderId) {
        if ("service-orders".equals(resource)) return;
        if ("shipping-orders".equals(resource)) {
            var rows = jdbc.query("select service_order_id, source_receiving_order_id from shipping_order where id = ?",
                    (rs, n) -> new Shipping(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class)), orderId);
            Shipping shipping = rows.getFirst();
            if (shipping.serviceId() == null) return;
            var initial = jdbc.query("""
                    select status, a_complex_service_id, accepted_container_count from receiving_order
                    where id = ? and service_role = 'INITIAL_RECEIVING' for share
                    """, (rs, n) -> new Initial(rs.getString(1), rs.getObject(2, UUID.class), (Integer)rs.getObject(3)), shipping.receivingId());
            if (initial.isEmpty() || !"COMPLETED".equals(initial.getFirst().status()))
                throw error("INITIAL_RECEIVING_NOT_COMPLETED", "Сначала выполните первоначальную поставку ЖД");
            Initial snapshot = initial.getFirst();
            if (snapshot.serviceId() == null || snapshot.count() == null)
                throw error("HISTORICAL_ACCEPTANCE_NOT_FIXED", "Для ранее выполненной поставки не зафиксирована разновидность А. Требуется отдельная сверка исторических данных");
            List<UUID> containers = jdbc.query("select container_id from shipping_order_source_container where shipping_order_id = ? order by container_id",
                    (rs, n) -> rs.getObject(1, UUID.class), orderId);
            for (UUID containerId : containers) charge(shipping.serviceId(), containerId, "A", snapshot.serviceId(), shipping.receivingId(), orderId, snapshot.count());
            return;
        }
        var rows = jdbc.query("select service_order_id, service_role, source_shipping_order_id from receiving_order where id = ?",
                (rs, n) -> new Receiving(rs.getObject(1, UUID.class), rs.getString(2), rs.getObject(3, UUID.class)), orderId);
        Receiving receiving = rows.getFirst();
        if (receiving.serviceId() == null) return;
        if ("INITIAL_RECEIVING".equals(receiving.role())) {
            Integer count = jdbc.queryForObject("""
                    select count(distinct wc.container_id) from waybill w
                    join waybill_railway_carriage rc on rc.waybill_id=w.id
                    join waybill_container wc on wc.waybill_railway_carriage_id=rc.id
                    where w.receiving_order_id=?
                    """, Integer.class, orderId);
            UUID catalogId = catalog(purposeForCount(count));
            jdbc.update("update receiving_order set accepted_container_count=?, a_complex_service_id=?, acceptance_fixed_at=current_timestamp where id=?",
                    count, catalogId, orderId);
        } else {
            var status = jdbc.queryForObject("select status from shipping_order where id = ? for share", String.class, receiving.shippingId());
            if (!"COMPLETED".equals(status)) throw error("SOURCE_SHIPPING_NOT_COMPLETED", "Сначала выполните исходный вывоз");
            UUID catalogId = catalog("B_AUTO_RETURN");
            for (UUID containerId : jdbc.query("select container_id from receiving_order_container where receiving_order_id=? order by container_id",
                    (rs, n) -> rs.getObject(1, UUID.class), orderId))
                charge(receiving.serviceId(), containerId, "B", catalogId, orderId, receiving.shippingId(), null);
        }
    }

    private UUID catalog(String purpose) {
        var ids = jdbc.query("select id from complex_service_catalog where purpose=?", (rs,n)->rs.getObject(1,UUID.class), purpose);
        if (ids.size()!=1) throw error("SERVICE_PURPOSE_NOT_CONFIGURED", "Не настроено назначение комплексной услуги " + purpose);
        return ids.getFirst();
    }

    private void charge(UUID parent, UUID container, String family, UUID catalogId, UUID receiving, UUID shipping, Integer count) {
        jdbc.update("""
                insert into service_execution(id,service_order_id,container_id,family,complex_service_id,receiving_order_id,shipping_order_id,status,accepted_container_count)
                values(?,?,?,?,?,?,?,'PLANNED',?) on conflict(service_order_id,container_id,family) do nothing
                """, UUID.randomUUID(),parent,container,family,catalogId,receiving,shipping,count);
        UUID execution = jdbc.queryForObject("select id from service_execution where service_order_id=? and container_id=? and family=? for update",UUID.class,parent,container,family);
        Integer exists = jdbc.queryForObject("select count(*) from billing_charge where service_execution_id=?",Integer.class,execution);
        if (exists != null && exists > 0) return;
        Boolean priced = jdbc.queryForObject("select priced_at is not null from service_execution where id=?",Boolean.class,execution);
        if (!Boolean.TRUE.equals(priced)) {
            var prices = jdbc.query("""
                    select t.id,t.coefficient,c.price_without_vat,c.price_with_vat
                    from service_execution e join service_order s on s.id=e.service_order_id
                    join complex_service_catalog c on c.id=e.complex_service_id
                    join complex_service_tariff t on t.complex_service_id=c.id and t.client_id=s.client_id and t.contract_id=s.contract_id
                    where e.id=? for share of c,t
                    """, (rs,n)->new Price(rs.getObject(1,UUID.class),rs.getBigDecimal(2),rs.getBigDecimal(3),rs.getBigDecimal(4)),execution);
            if(prices.size()!=1) throw error("TARIFF_NOT_FOUND", "Не найден тариф услуги " + family + " для клиента и договора родительской заявки. Настройте тариф и повторите выполнение");
            Price p=prices.getFirst();
            jdbc.update("""
                    update service_execution set tariff_id=?,coefficient=?,base_price_without_vat=?,base_price_with_vat=?,
                        price_without_vat=?,price_with_vat=?,priced_at=current_timestamp where id=?
                    """,p.id(),p.coefficient(),p.withoutVat(),p.withVat(),price(p.withoutVat(),p.coefficient()),price(p.withVat(),p.coefficient()),execution);
        }
        jdbc.update("update service_execution set status='PERFORMED',performed_at=coalesce(performed_at,current_timestamp) where id=?",execution);
        jdbc.update("""
                insert into billing_charge(id,service_execution_id,client_id,contract_id,performed_at,quantity,price_without_vat,amount_without_vat,price_with_vat,amount_with_vat,currency)
                select ?,e.id,s.client_id,s.contract_id,e.performed_at,1,e.price_without_vat,e.price_without_vat,e.price_with_vat,e.price_with_vat,'RUB'
                from service_execution e join service_order s on s.id=e.service_order_id where e.id=?
                on conflict(service_execution_id) do nothing
                """, UUID.randomUUID(), execution);
    }
    private static ApiException error(String code,String message){return new ApiException(HttpStatus.CONFLICT,code,message);}
    private record Shipping(UUID serviceId,UUID receivingId){}
    private record Initial(String status,UUID serviceId,Integer count){}
    private record Receiving(UUID serviceId,String role,UUID shippingId){}
    private record Price(UUID id,BigDecimal coefficient,BigDecimal withoutVat,BigDecimal withVat){}
}
