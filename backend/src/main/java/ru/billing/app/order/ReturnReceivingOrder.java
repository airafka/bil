package ru.billing.app.order;
import java.util.UUID;
import java.util.List;
import java.util.Arrays;
import org.springframework.jdbc.core.JdbcTemplate;
public record ReturnReceivingOrder(UUID id, int code, String status, List<String> containerNames,
        java.time.LocalDateTime plannedAt, String consignor, List<UUID> containerIds,
        UUID comprehensiveServiceOrderId, int comprehensiveServiceOrderCode, String clientName, String contractName) {
    public static List<ReturnReceivingOrder> find(JdbcTemplate jdbc, String condition, Object... args) {
        return jdbc.query("""
            select r.id,r.number,r.order_status,r.plan_receiving_date_time,r.consignor,
                   r.comprehensive_service_order_id,s.code as service_code,cl.name as client_name,ct.name as contract_name,
                   array_agg(c.code order by c.code) as names, array_agg(c.id order by c.code) as ids
            from receiving_order r join receiving_order_container rc on rc.receiving_order_id=r.id
            join container c on c.id=rc.container_id join comprehensive_service_order s on s.id=r.comprehensive_service_order_id
            join client cl on cl.id=r.client_id join contract ct on ct.id=r.contract_id
            join shipping_order sh on sh.id=r.source_shipping_order_id
            where r.service_role='RETURN_RECEIVING' and (
            """+condition+") group by r.id,s.code,cl.name,ct.name order by r.number",
            (rs,n)->new ReturnReceivingOrder(rs.getObject("id",UUID.class),rs.getInt("number"),rs.getString("order_status"),
            Arrays.stream((Object[])rs.getArray("names").getArray()).map(Object::toString).toList(),
            rs.getObject("plan_receiving_date_time",java.time.LocalDateTime.class),rs.getString("consignor"),
            Arrays.stream((Object[])rs.getArray("ids").getArray()).map(x->(UUID)x).toList(),
            rs.getObject("comprehensive_service_order_id",UUID.class),rs.getInt("service_code"),rs.getString("client_name"),rs.getString("contract_name")),args);
    }
}
