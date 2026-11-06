package ru.billing.app.comprehensiveserviceorder;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
@Service
public class ServiceTariffSnapshot {
    private final JdbcTemplate jdbc;
    public ServiceTariffSnapshot(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public void fix(UUID orderId, UUID clientId, UUID contractId, UUID serviceId) {
        var tariffs = jdbc.query("""
                select t.id from complex_service_tariff t join complex_service_catalog c on c.id=t.complex_service_id
                where t.client_id=? and t.contract_id=? and t.complex_service_id=? and t.active for share of c,t
                """, (rs,n)->rs.getObject(1,UUID.class),clientId,contractId,serviceId);
        if(tariffs.size()!=1) throw new ru.billing.app.error.ApiException(HttpStatus.CONFLICT,"ACTIVE_TARIFFS_REQUIRED","Для выбранной услуги нужен активный тариф по клиенту и договору");
        jdbc.update("""
                insert into comprehensive_service_order_tariff
                (comprehensive_service_order_id,complex_service_id,tariff_id,coefficient,
                 base_price_without_vat,base_price_with_vat,price_without_vat,price_with_vat)
                select ?,c.id,t.id,t.coefficient,c.price_without_vat,c.price_with_vat,
                       round(c.price_without_vat*t.coefficient,2),round(c.price_with_vat*t.coefficient,2)
                from complex_service_tariff t join complex_service_catalog c on c.id=t.complex_service_id where t.id=?
                """,orderId,tariffs.getFirst());
        jdbc.update("update comprehensive_service_order set tariffs_fixed_at=current_timestamp where id=?",orderId);
    }

}
