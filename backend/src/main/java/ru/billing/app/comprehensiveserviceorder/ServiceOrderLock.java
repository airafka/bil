package ru.billing.app.comprehensiveserviceorder;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
public final class ServiceOrderLock {
    private ServiceOrderLock() {}
    public static void lock(JdbcTemplate jdbc, UUID id) {
        jdbc.query("""
            select id from comprehensive_service_order where id=? or id=(select source_service_order_id from comprehensive_service_order where id=?)
            order by source_service_order_id nulls first,id for update
            """,(rs,n)->rs.getObject(1,UUID.class),id,id);
    }
}
