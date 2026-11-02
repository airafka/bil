package ru.billing.app.containerstock;

import java.util.*;
import java.time.LocalDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.PagedResponse;

@Service
public class ContainerStockService {
    private final JdbcTemplate jdbc;
    public ContainerStockService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Owner(UUID id, UUID containerId, String containerName, String containerType,
            UUID clientId, String clientName, String status, UUID receivingOrderId, UUID shippingOrderId) {}
    public record Lookup(UUID containerId, UUID ownerClientId, String ownerClientName, String status) {}
    @Transactional(readOnly=true)
    public List<Lookup> lookup(List<UUID> containerIds) {
        var ids = containerIds.stream().distinct().toList();
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        var result = jdbc.query("select c.id, o.client_id, cl.name, o.status from container c "
            + "left join container_owner o on o.container_id=c.id left join client cl on cl.id=o.client_id "
            + "where c.id in (" + placeholders + ") order by c.code",
            (rs,n) -> new Lookup(rs.getObject(1,UUID.class), rs.getObject(2,UUID.class), rs.getString(3), rs.getString(4)), ids.toArray());
        if (result.size()!=ids.size()) throw new ApiException(HttpStatus.NOT_FOUND,"CONTAINER_NOT_FOUND","КТК не найден");
        return result;
    }
    public record History(UUID id, UUID containerId, UUID oldClientId, String oldClientName,
            UUID newClientId, String newClientName, String oldStatus, String newStatus,
            UUID orderId, String orderType, Long orderNumber, LocalDateTime createdAt) {}
    record State(UUID id, UUID client, String status, UUID receiving, UUID shipping) {}

    public void lockContainers(Collection<UUID> ids) {
        for (UUID id : new TreeSet<>(ids)) {
            var found=jdbc.query("select id from container where id=? for update",(rs,n)->rs.getObject(1,UUID.class),id);
            if(found.isEmpty()) throw error("CONTAINER_NOT_FOUND","КТК не найден");
        }
    }
    State state(UUID id) {
        var rows=jdbc.query("select * from container_owner where container_id=?",(rs,n)->new State(
            rs.getObject("id",UUID.class),rs.getObject("client_id",UUID.class),rs.getString("status"),
            rs.getObject("receiving_order_id",UUID.class),rs.getObject("shipping_order_id",UUID.class)),id);
        return rows.isEmpty()?null:rows.getFirst();
    }
    void transition(UUID container, UUID client, String status, UUID receiving, UUID shipping, UUID order, String type) {
        State old=state(container);
        if(old==null) jdbc.update("insert into container_owner(id,container_id,client_id,status,receiving_order_id,shipping_order_id) values(?,?,?,?,?,?)",
            UUID.randomUUID(),container,client,status,receiving,shipping);
        else jdbc.update("update container_owner set client_id=?,status=?,receiving_order_id=?,shipping_order_id=?,updated_at=now() at time zone 'UTC',updated_by='local' where id=?",
            client,status,receiving,shipping,old.id());
        // Only drafts follow the register. Confirmation freezes the shipment owner.
        jdbc.update("""
            update shipping_order_container sc set owner_container_id=?
            from shipping_order s where s.id=sc.shipping_order_id and s.order_status='DRAFT'
                and sc.container_id=?
            """,client,container);
        if(old==null || !Objects.equals(old.client(),client) || !Objects.equals(old.status(),status))
            jdbc.update("insert into container_owner_history(id,container_id,old_client_id,new_client_id,old_status,new_status,order_id,order_type) values(?,?,?,?,?,?,?,?)",
                UUID.randomUUID(),container,old==null?null:old.client(),client,old==null?null:old.status(),status,order,type);
    }
    public void onOrderTransition(String resource, UUID order, boolean completed) {
        if(resource.equals("comprehensive-service-orders")) return;
        boolean receiving=resource.equals("receiving-orders");
        String table=receiving?"receiving_order_container":"shipping_order_container";
        String column=receiving?"receiving_order_id":"shipping_order_id";
        record Row(UUID container,UUID owner) {}
        var rows=jdbc.query("select container_id,owner_container_id from "+table+" where "+column+"=? order by container_id",
            (rs,n)->new Row(rs.getObject(1,UUID.class),rs.getObject(2,UUID.class)),order);
        // Legacy empty orders have no physical KTK to reserve.
        if(rows.isEmpty()) {
            if(receiving) {
                Integer missing=jdbc.queryForObject("select count(*) from waybill w join waybill_railway_carriage rc on rc.waybill_id=w.id join waybill_container wc on wc.waybill_railway_carriage_id=rc.id where w.receiving_order_id=?",Integer.class,order);
                if(missing!=null&&missing>0) throw error("RECEIVING_OWNER_REQUIRED","Укажите собственников КТК в заявке на поставку");
            }
            return;
        }
        lockContainers(rows.stream().map(Row::container).toList());
        for(var row:rows) {
            State old=state(row.container());
            if(receiving) {
                if(!completed) {
                    if(row.owner()==null) throw error("RECEIVING_OWNER_REQUIRED","Укажите собственника каждого КТК в заявке на поставку");
                    if(old!=null&&!old.status().equals("DEPARTED")) throw error("CONTAINER_ALREADY_IN_STOCK","КТК уже ожидается, находится на терминале или зарезервирован для вывоза");
                    transition(row.container(),row.owner(),"EXPECTED",order,old==null?null:old.shipping(),order,"RECEIVING_ORDER");
                } else {
                    if(old==null||!old.status().equals("EXPECTED")||!order.equals(old.receiving())) throw error("RECEIVING_RESERVATION_REQUIRED","КТК не зарезервирован этой поставкой");
                    transition(row.container(),old.client(),"ON_TERMINAL",order,old.shipping(),order,"RECEIVING_ORDER");
                }
            } else {
                if(!completed) {
                    if(old==null||!old.status().equals("ON_TERMINAL")) throw error("SHIPPING_MISSING_IN_REMAINS","Для вывоза КТК должен быть принят и свободен в остатках");
                    jdbc.update("update shipping_order_container set owner_container_id=? where shipping_order_id=? and container_id=?",old.client(),order,row.container());
                    transition(row.container(),old.client(),"RESERVED_OUT",old.receiving(),order,order,"SHIPPING_ORDER");
                } else {
                    if(old==null||!old.status().equals("RESERVED_OUT")||!order.equals(old.shipping())) throw error("SHIPPING_RESERVATION_REQUIRED","КТК не зарезервирован этим вывозом");
                    transition(row.container(),old.client(),"DEPARTED",old.receiving(),order,order,"SHIPPING_ORDER");
                }
            }
            if(completed) jdbc.update("""
                insert into container_movement(id,order_id,container_id,event_code,transport_type)
                select ?,?,?,?,transport_type from %s where id=?
                on conflict(order_id,container_id,event_code) do nothing
                """.formatted(receiving?"receiving_order":"shipping_order"),UUID.randomUUID(),order,row.container(),receiving?"UNLOAD_FINISH":"LOAD_FINISH",order);
        }
    }
    static final String OWNER_SELECT="""
        select o.*,c.code as container_name,c.container_type,cl.name as client_name
        from container_owner o join container c on c.id=o.container_id join client cl on cl.id=o.client_id
        """;
    Owner owner(java.sql.ResultSet rs)throws java.sql.SQLException {
        return new Owner(rs.getObject("id",UUID.class),rs.getObject("container_id",UUID.class),rs.getString("container_name"),
            rs.getString("container_type"),rs.getObject("client_id",UUID.class),rs.getString("client_name"),rs.getString("status"),
            rs.getObject("receiving_order_id",UUID.class),rs.getObject("shipping_order_id",UUID.class));
    }
    @Transactional(readOnly=true)
    public PagedResponse<Owner> page(String query, UUID client, String status, boolean remains, int page, int size) {
        page=Math.max(0,page);size=Math.max(1,Math.min(100,size));
        if(status!=null&&!Set.of("EXPECTED","ON_TERMINAL","RESERVED_OUT","DEPARTED").contains(status))throw error("INVALID_CONTAINER_STATUS","Неизвестный статус КТК");
        String filter=" where (?='' or position(lower(?) in lower(c.code||' '||cl.name))>0) and (?::uuid is null or o.client_id=?) and (?::text is null or o.status=?) and (not ? or o.status in ('ON_TERMINAL','RESERVED_OUT'))";
        Object[] args={query,query,client,client,status,status,remains};
        long count=jdbc.queryForObject("select count(*) from ("+OWNER_SELECT+filter+") q",Long.class,args);
        var params=new ArrayList<>(Arrays.asList(args));params.add(size);params.add(page*size);
        return PagedResponse.of(jdbc.query(OWNER_SELECT+filter+" order by c.code,o.id limit ? offset ?",(rs,n)->owner(rs),params.toArray()),page,size,count);
    }
    @Transactional(readOnly=true)
    public List<History> history(UUID container, boolean all) {
        if(jdbc.queryForObject("select count(*) from container where id=?",Integer.class,container)==0)throw error("CONTAINER_NOT_FOUND","КТК не найден");
        return jdbc.query("""
            select h.*,old.name as old_name,new.name as new_name,
                coalesce(r.number,s.number,so.number) as order_number
            from container_owner_history h left join client old on old.id=h.old_client_id
            left join client new on new.id=h.new_client_id
            left join receiving_order r on h.order_type='RECEIVING_ORDER' and r.id=h.order_id
            left join shipping_order s on h.order_type='SHIPPING_ORDER' and s.id=h.order_id
            left join service_order so on h.order_type='SERVICE_ORDER' and so.id=h.order_id
            where h.container_id=? and (? or (h.new_status in ('ON_TERMINAL','DEPARTED')
                and (r.order_status='COMPLETED' or s.order_status='COMPLETED' or so.status='DONE')))
            order by h.created_at desc,h.id desc
            """,(rs,n)->new History(rs.getObject("id",UUID.class),container,rs.getObject("old_client_id",UUID.class),rs.getString("old_name"),
                rs.getObject("new_client_id",UUID.class),rs.getString("new_name"),rs.getString("old_status"),rs.getString("new_status"),
                rs.getObject("order_id",UUID.class),rs.getString("order_type"),rs.getObject("order_number",Long.class),rs.getObject("created_at",LocalDateTime.class)),container,all);
    }
    ApiException error(String code,String message){return new ApiException(HttpStatus.CONFLICT,code,message);}
}
