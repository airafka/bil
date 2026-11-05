package ru.billing.app.order;

import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.error.ApiException;

@org.springframework.stereotype.Service
public class OrderStatusService {
    private final JdbcTemplate jdbc;
    private final ru.billing.app.billing.BillingService billing;
    private final ru.billing.app.containerstock.ContainerStockService stock;
    public OrderStatusService(JdbcTemplate jdbc, ru.billing.app.billing.BillingService billing, ru.billing.app.containerstock.ContainerStockService stock) { this.jdbc = jdbc; this.billing = billing; this.stock = stock; }

    @Transactional
    public CreatedOrderResponse finish(String resource, UUID id, String eventCode) {
        lockOrderRoute(resource, id);
        boolean receiving = resource.equals("receiving-orders");
        if (!(receiving ? "UNLOAD_FINISH" : "LOAD_FINISH").equals(eventCode))
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_CONTAINER_EVENT","Для поставки требуется UNLOAD_FINISH, для вывоза — LOAD_FINISH");
        var rows=jdbc.query("select number,order_status from " + (receiving ? "receiving_order" : "shipping_order") + " where id=? for update",
            (rs,n)->new CreatedOrderResponse(id,rs.getInt(1),rs.getString(2)),id);
        if(rows.isEmpty())throw new ApiException(HttpStatus.NOT_FOUND,"ORDER_NOT_FOUND","Заявка не найдена");
        if(rows.getFirst().status().equals("COMPLETED")) return rows.getFirst();
        return change(resource,id,new ChangeStatusRequest(Status.CONFIRMED,Status.COMPLETED));
    }
    public enum Status { DRAFT, CONFIRMED, COMPLETED }
    public record ChangeStatusRequest(@NotNull Status expectedStatus, @NotNull Status status) {}

    @Transactional
    public CreatedOrderResponse change(String resource, UUID id,
            ChangeStatusRequest request) {
        if (!resource.equals("comprehensive-service-orders") && request.status() == Status.CONFIRMED)
            throw new ApiException(HttpStatus.CONFLICT, "CONFIRM_THROUGH_ROUTE", "Подтвердите заявку через рейс");
        if(resource.equals("comprehensive-service-orders")) throw new ApiException(HttpStatus.CONFLICT,"SERVICE_STATUS_AUTOMATIC","Статус услуги меняется автоматически после выполнения связанных заявок");
        lockOrderRoute(resource, id);
        return changeInternal(resource, id, request);
    }

    private CreatedOrderResponse changeInternal(String resource, UUID id, ChangeStatusRequest request) {
        String table = switch (resource) {
            case "receiving-orders" -> "receiving_order";
            case "shipping-orders" -> "shipping_order";
            case "comprehensive-service-orders" -> "comprehensive_service_order";
            default -> throw new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Заявка не найдена");
        };
        String numberColumn = "comprehensive-service-orders".equals(resource) ? "code" : "number";
        String statusColumn = "comprehensive-service-orders".equals(resource) ? "status" : "order_status";
        var rows = jdbc.query("select " + numberColumn + " as code, " + statusColumn + " as status from " + table + " where id = ? for update",
                (rs, row) -> new CreatedOrderResponse(id, rs.getInt("code"), rs.getString("status")), id);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Заявка не найдена");
        var current = rows.getFirst();
        if (!current.status().equals(request.expectedStatus().name())) {
            throw new ApiException(HttpStatus.CONFLICT, "STATUS_CHANGED", "Статус уже изменён. Обновите страницу перед следующим действием.");
        }
        boolean allowed = request.expectedStatus() == Status.DRAFT && request.status() == Status.CONFIRMED
                || request.expectedStatus() == Status.CONFIRMED && request.status() == Status.COMPLETED;
        if (!allowed) throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATUS_TRANSITION",
                "Допустимы только переходы: Черновик → Подтверждено → Выполнено");
        if ("receiving-orders".equals(resource) && request.status() == Status.COMPLETED) {
            var sourceCompleted = jdbc.query("""
                    select sh.order_status = 'COMPLETED' from receiving_order r
                    join shipping_order sh on sh.id = r.source_shipping_order_id
                    where r.id = ? and r.service_role = 'RETURN_RECEIVING'
                    """, (rs, row) -> rs.getBoolean(1), id);
            if (!sourceCompleted.isEmpty() && Boolean.FALSE.equals(sourceCompleted.getFirst())) throw new ApiException(HttpStatus.CONFLICT,
                    "SOURCE_SHIPPING_NOT_COMPLETED", "Сначала выполните исходный вывоз");
        }
        if ("comprehensive-service-orders".equals(resource) && request.status() == Status.COMPLETED) {
            Integer unfinishedReceiving = jdbc.queryForObject("select count(*) from receiving_order where comprehensive_service_order_id = ? and order_status <> 'COMPLETED'", Integer.class, id);
            Integer unfinishedShipping = jdbc.queryForObject("select count(*) from shipping_order where comprehensive_service_order_id = ? and order_status <> 'COMPLETED'", Integer.class, id);
            if ((unfinishedReceiving != null && unfinishedReceiving > 0) || (unfinishedShipping != null && unfinishedShipping > 0)) {
                throw new ApiException(HttpStatus.CONFLICT, "SERVICE_CHILD_ORDERS_UNFINISHED",
                        "Завершите связанные поставки и вывозы перед выполнением услуги");
            }
            Integer remaining = jdbc.queryForObject("""
                    select count(distinct wc.container_id)
                    from receiving_order r
                    join waybill_details w on w.receiving_order_id = r.id
                    join waybill_railway_carriage rc on rc.waybill_id = w.id
                    join waybill_container_details wc on wc.waybill_railway_carriage_id = rc.id
                    where r.comprehensive_service_order_id = ? and not exists (
                        select 1 from shipping_order_source_container link
                        where link.comprehensive_service_order_id = r.comprehensive_service_order_id
                          and link.container_id = wc.container_id
                    )
                    """, Integer.class, id);
            if (remaining != null && remaining > 0) throw new ApiException(HttpStatus.CONFLICT,
                    "SERVICE_CONTAINERS_UNASSIGNED", "Создайте заявки на вывоз для всех КТК перед выполнением услуги");
        }
        stock.onOrderTransition(resource,id,request.status() == Status.COMPLETED);
        if (request.status() == Status.COMPLETED) billing.complete(resource, id);
        jdbc.update("update " + table + " set " + statusColumn + " = ? where id = ?", request.status().name(), id);
        if (!resource.equals("comprehensive-service-orders") && request.status() == Status.COMPLETED) {
            jdbc.update("""
                update route r set status='COMPLETED'
                where r.id=(select route_id from %s where id=?) and r.status='CONFIRMED'
                  and not exists (select 1 from receiving_order where route_id=r.id and order_status<>'COMPLETED')
                  and not exists (select 1 from shipping_order where route_id=r.id and order_status<>'COMPLETED')
                """.formatted(table), id);
        }
        if (!resource.equals("comprehensive-service-orders") && request.status() == Status.COMPLETED) {
            jdbc.update("""
                update comprehensive_service_order s set status='COMPLETED'
                where s.id=(select comprehensive_service_order_id from %s where id=?) and s.status<>'COMPLETED'
                  and not exists(select 1 from receiving_order where comprehensive_service_order_id=s.id and order_status<>'COMPLETED')
                  and not exists(select 1 from shipping_order where comprehensive_service_order_id=s.id and order_status<>'COMPLETED')
                  and exists(select 1 from receiving_order where comprehensive_service_order_id=s.id and service_role='RETURN_RECEIVING')
                    and not exists(select 1 from shipping_order_source_container link where link.comprehensive_service_order_id=s.id
                      and not exists(select 1 from receiving_order r join receiving_order_container rc on rc.receiving_order_id=r.id
                        where r.source_shipping_order_id=link.shipping_order_id and r.service_role='RETURN_RECEIVING'
                          and r.order_status='COMPLETED' and rc.container_id=link.container_id))
                  and not exists(select 1 from receiving_order r join waybill_details w on w.receiving_order_id=r.id
                      join waybill_railway_carriage rc on rc.waybill_id=w.id
                      join waybill_container_details wc on wc.waybill_railway_carriage_id=rc.id
                      where r.comprehensive_service_order_id=s.id and not exists(select 1 from shipping_order_source_container link
                          where link.comprehensive_service_order_id=s.id and link.container_id=wc.container_id))
                """.formatted(table),id);
        }
        return new CreatedOrderResponse(id, current.code(), request.status().name());
    }
    // All lifecycle operations lock the route before its orders, including concurrent completions.
    private void lockOrderRoute(String resource, UUID id) {
        String table = switch(resource) {
            case "receiving-orders" -> "receiving_order";
            case "shipping-orders" -> "shipping_order";
            default -> null;
        };
        if(table != null) jdbc.query("select s.id from comprehensive_service_order s join " + table + " o on o.comprehensive_service_order_id=s.id where o.id=? for update of s", (rs,n)->rs.getObject(1,UUID.class),id);
        if (table != null) jdbc.query("select r.id from route r join " + table + " o on o.route_id=r.id where o.id=? for update of r", (rs,n)->rs.getObject(1, UUID.class), id);
    }

    @Transactional
    public void confirmRoute(UUID routeId) {
        var routes=jdbc.query("select status from route where id=? for update", (rs,n)->rs.getString(1), routeId);
        if(routes.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"ROUTE_NOT_FOUND","Рейс не найден");
        if(!routes.getFirst().equals("DRAFT")) throw new ApiException(HttpStatus.CONFLICT,"ROUTE_NOT_DRAFT","Рейс уже подтверждён. Обновите страницу");
        record Order(String resource, UUID id, int number, String status, boolean dateMissing, boolean partyMissing) {}
        var orders=new java.util.ArrayList<Order>();
        orders.addAll(jdbc.query("select id,number,order_status,plan_receiving_date_time,consignor from receiving_order where route_id=? order by id for update",
            (rs,n)->new Order("receiving-orders",rs.getObject(1,UUID.class),rs.getInt(2),rs.getString(3),rs.getObject(4)==null,rs.getString(5)==null||rs.getString(5).isBlank()),routeId));
        orders.addAll(jdbc.query("select s.id,s.number,s.order_status,s.planned_shipping_date_time,(select name from client_related_entity where id=s.consignee_id) from shipping_order s where s.route_id=? order by s.id for update of s",
            (rs,n)->new Order("shipping-orders",rs.getObject(1,UUID.class),rs.getInt(2),rs.getString(3),rs.getObject(4)==null,rs.getString(5)==null||rs.getString(5).isBlank()),routeId));
        if(orders.isEmpty()) throw new ApiException(HttpStatus.CONFLICT,"ROUTE_EMPTY","Добавьте заявки в рейс");
        var errors=new java.util.ArrayList<String>();
        for(var order:orders) {
            if(!order.status().equals("DRAFT")) throw new ApiException(HttpStatus.CONFLICT,"ORDER_NOT_DRAFT","Заявка №"+order.number()+" уже не в статусе Черновик");
            var fields=new java.util.ArrayList<String>();
            if(order.dateMissing()) fields.add(order.resource().equals("receiving-orders")?"Дата и время поступления":"Дата и время вывоза");
            if(order.partyMissing()) fields.add(order.resource().equals("receiving-orders")?"Грузоотправитель":"Грузополучатель");
            if(!fields.isEmpty()) errors.add("Заявка №"+order.number()+": "+String.join(", ",fields));
        }
        if(!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST,"ORDER_CONFIRMATION_FIELDS_REQUIRED","Заполните обязательные поля. "+String.join("; ",errors));
        for(var order:orders) changeInternal(order.resource(),order.id(),new ChangeStatusRequest(Status.DRAFT,Status.CONFIRMED));
        jdbc.update("update route set status='CONFIRMED' where id=?",routeId);
    }
}
