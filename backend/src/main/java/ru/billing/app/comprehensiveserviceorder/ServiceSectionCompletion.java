package ru.billing.app.comprehensiveserviceorder;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.OrderStatusService;

@Service
public class ServiceSectionCompletion {
    public enum Action { CONFIRM_ROUTES, COMPLETE_ORDERS }
    public record Request(@NotNull ServiceTransportPreparation.Section section, @NotNull Action action) {}
    private record Order(UUID id, int number, String status, UUID route) {}
    private final JdbcTemplate jdbc;
    private final OrderStatusService statuses;
    private final ComprehensiveServiceOrderService services;
    public ServiceSectionCompletion(JdbcTemplate jdbc,OrderStatusService statuses,ComprehensiveServiceOrderService services) {
        this.jdbc=jdbc;this.statuses=statuses;this.services=services;
    }

    @Transactional
    public ComprehensiveServiceOrderDetails complete(UUID id,ServiceTransportPreparation.Section section,Action action) {
        if(jdbc.queryForList("select id from comprehensive_service_order where id=? for update",id).isEmpty())
            throw new ApiException(HttpStatus.NOT_FOUND,"COMPREHENSIVE_SERVICE_ORDER_NOT_FOUND","Заявка на услугу не найдена");
        boolean shipping=section==ServiceTransportPreparation.Section.SHIPPING;
        String table=shipping?"shipping_order":"receiving_order";
        String query="select id,number,order_status,route_id from "+table+" where comprehensive_service_order_id=?"
                +(shipping?"":" and service_role=?")+" order by id";
        Object[] args=shipping?new Object[]{id}:new Object[]{id,section.name()};
        org.springframework.jdbc.core.RowMapper<Order> mapper=(rs,n)->new Order(rs.getObject(1,UUID.class),rs.getInt(2),rs.getString(3),rs.getObject(4,UUID.class));
        var initial=jdbc.query(query,mapper,args);
        // Follow lifecycle lock order: parent, routes in stable order, then orders.
        var routeIds=initial.stream().map(Order::route).filter(Objects::nonNull).distinct().sorted().toList();
        for(var route:routeIds) jdbc.queryForList("select id from route where id=? for update",route);
        var orders=jdbc.query(query+" for update",mapper,args);
        var originalRoutes=new HashMap<UUID,UUID>();for(var order:initial)originalRoutes.put(order.id(),order.route());
        for(var order:orders) {
            if(!originalRoutes.containsKey(order.id())||!Objects.equals(originalRoutes.get(order.id()),order.route()))
                throw error("SECTION_CHANGED","Состав рейсов изменился. Обновите страницу и повторите действие");
            if(!"COMPLETED".equals(order.status()) && order.route()==null)
                throw error("SECTION_ROUTE_REQUIRED","Сначала создайте рейс для заявки №"+order.number());
        }
        if(action==Action.COMPLETE_ORDERS && orders.stream().anyMatch(o->"DRAFT".equals(o.status())))
            throw error("SECTION_CONFIRM_FIRST","Сначала подтвердите все рейсы раздела");
        Set<UUID> selected=new HashSet<>(orders.stream().map(Order::id).toList());
        if(action==Action.CONFIRM_ROUTES) for(var route:routeIds) {
            var status=jdbc.queryForObject("select status from route where id=?",String.class,route);
            if(!"DRAFT".equals(status))continue;
            var members=jdbc.query("select id from receiving_order where route_id=? union all select id from shipping_order where route_id=?",
                    (rs,n)->rs.getObject(1,UUID.class),route,route);
            if(!selected.containsAll(members)) throw error("SHARED_ROUTE_OUTSIDE_SECTION",
                    "В рейсе есть заявки другого раздела или услуги. Подтвердите такой рейс отдельно в его карточке");
            statuses.confirmRoute(route);
        }
        // Each phase is atomic; completing requires a separate explicit request.
        if(action==Action.COMPLETE_ORDERS) for(var order:orders) if(!"COMPLETED".equals(order.status()))
            statuses.finish(shipping?"shipping-orders":"receiving-orders",order.id(),shipping?"LOAD_FINISH":"UNLOAD_FINISH");
        return services.findById(id);
    }
    private static ApiException error(String code,String message){return new ApiException(HttpStatus.CONFLICT,code,message);}
}

@RestController
@RequestMapping("/api/comprehensive-service-orders/{id}/complete-section")
class ServiceSectionCompletionController {
    private final ServiceSectionCompletion service;
    ServiceSectionCompletionController(ServiceSectionCompletion service){this.service=service;}
    @PostMapping
    public ComprehensiveServiceOrderDetails complete(@PathVariable UUID id,@Valid @RequestBody ServiceSectionCompletion.Request request){return service.complete(id,request.section(),request.action());}
}
