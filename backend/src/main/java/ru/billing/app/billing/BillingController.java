package ru.billing.app.billing;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/billing-charges")
public class BillingController {
    private final JdbcTemplate jdbc;
    public BillingController(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public record Charge(UUID id, OffsetDateTime performedAt, String clientName, String contractName,
            UUID serviceOrderId,int serviceOrderCode,String containerName,String serviceName,String family,
            UUID receivingOrderId,int receivingOrderCode,UUID shippingOrderId,int shippingOrderCode,
            BigDecimal amountWithoutVat,BigDecimal amountWithVat,String currency){}
    public record ChargePage(List<Charge> items,BigDecimal totalWithoutVat,BigDecimal totalWithVat,long total,int page,int size){}
    @GetMapping
    @Transactional(readOnly=true)
    public ChargePage find(@RequestParam(required=false) UUID serviceOrderId,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){
        page=Math.max(0,page); size=Math.max(1,Math.min(size,100));
        String filter=serviceOrderId==null?"":" where e.service_order_id=?";
        Object[] args=serviceOrderId==null?new Object[]{}:new Object[]{serviceOrderId};
        var totals=jdbc.queryForMap("select count(*) as total,coalesce(sum(b.amount_without_vat),0) as without_vat,coalesce(sum(b.amount_with_vat),0) as with_vat from billing_charge b join service_execution e on e.id=b.service_execution_id"+filter,args);
        var params=new java.util.ArrayList<Object>(java.util.Arrays.asList(args));params.add(size);params.add(page*size);
        var items=jdbc.query("""
                select b.id,b.performed_at,c.code as client_name,ct.name as contract_name,s.id as service_order_id,s.code as service_order_code,
                    k.code as container_name,cat.name as service_name,e.family,r.id as receiving_id,r.code as receiving_code,
                    sh.id as shipping_id,sh.code as shipping_code,b.amount_without_vat,b.amount_with_vat,b.currency
                from billing_charge b join service_execution e on e.id=b.service_execution_id
                join service_order s on s.id=e.service_order_id join client c on c.id=b.client_id join contract ct on ct.id=b.contract_id
                join container k on k.id=e.container_id join complex_service_catalog cat on cat.id=e.complex_service_id
                join receiving_order r on r.id=e.receiving_order_id join shipping_order sh on sh.id=e.shipping_order_id
                """+filter+" order by b.performed_at desc,b.id limit ? offset ?",(rs,n)->new Charge(rs.getObject("id",UUID.class),rs.getObject("performed_at",OffsetDateTime.class),
                    rs.getString("client_name"),rs.getString("contract_name"),rs.getObject("service_order_id",UUID.class),rs.getInt("service_order_code"),
                    rs.getString("container_name"),rs.getString("service_name"),rs.getString("family"),rs.getObject("receiving_id",UUID.class),rs.getInt("receiving_code"),
                    rs.getObject("shipping_id",UUID.class),rs.getInt("shipping_code"),rs.getBigDecimal("amount_without_vat"),rs.getBigDecimal("amount_with_vat"),rs.getString("currency")),params.toArray());
        return new ChargePage(items,(BigDecimal)totals.get("without_vat"),(BigDecimal)totals.get("with_vat"),((Number)totals.get("total")).longValue(),page,size);
    }
}
