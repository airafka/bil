package ru.billing.app.comprehensiveserviceorder;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.TransportType;
import ru.billing.app.reference.PartyReferences;
import ru.billing.app.reference.TransportCatalogService;
import ru.billing.app.route.*;

@Service
public class ServiceTransportPreparation {
    public enum Section { INITIAL_RECEIVING, SHIPPING, RETURN_RECEIVING }
    public record Request(@NotNull Section section) {}
    private record Order(UUID id, UUID area, TransportType transport, UUID route, String party) {}
    private final JdbcTemplate jdbc;
    private final RouteService routes;
    private final TransportCatalogService catalogs;
    private final ComprehensiveServiceOrderService orders;

    public ServiceTransportPreparation(JdbcTemplate jdbc, RouteService routes,
            TransportCatalogService catalogs, ComprehensiveServiceOrderService orders) {
        this.jdbc=jdbc; this.routes=routes; this.catalogs=catalogs; this.orders=orders;
    }

    @Transactional
    public ComprehensiveServiceOrderDetails prepare(UUID id, Section section) {
        var parents=jdbc.query("select c.name from comprehensive_service_order s join client c on c.id=s.client_id where s.id=? for update of s",
                (rs,n)->rs.getString(1),id);
        if(parents.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"COMPREHENSIVE_SERVICE_ORDER_NOT_FOUND","Заявка на услугу не найдена");
        boolean shipping=section==Section.SHIPPING;
        String table=shipping?"shipping_order":"receiving_order";
        String party=shipping?"(select name from client_related_entity where id=o.consignee_id)":"o.consignor";
        var selected=jdbc.query("select o.id,o.terminal_area_catalog_id,o.transport_type,o.route_id,"+party+" as party from "+table
                +" o where o.comprehensive_service_order_id=? and o.order_status='DRAFT'"
                +(shipping?"":" and o.service_role=?")+" order by o.id for update of o",
                (rs,n)->new Order(rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),TransportType.valueOf(rs.getString(3)),rs.getObject(4,UUID.class),rs.getString(5)),
                shipping?new Object[]{id}:new Object[]{id,section.name()});
        if(selected.isEmpty()) return orders.findById(id);
        UUID carrier=null,driver=null,vehicle=null;
        if(selected.stream().anyMatch(o->o.route()==null && o.transport()==TransportType.VEHICLE)) {
            carrier=first("carriers","перевозчика"); driver=first("drivers","водителя"); vehicle=first("vehicles","транспортное средство");
        }
        // Use one Moscow instant for the entire section, independent of host/browser timezone.
        OffsetDateTime now=OffsetDateTime.now(ZoneId.of("Europe/Moscow")).truncatedTo(ChronoUnit.MINUTES);
        for(var order:selected) {
            boolean emptyParty=order.party()==null||order.party().isBlank();
            if(shipping) {
                jdbc.update("update shipping_order set planned_shipping_date_time=? where id=?",now.toLocalDateTime(),order.id());
                if(emptyParty) jdbc.update("update shipping_order set consignee_id=? where id=?",PartyReferences.clientParty(jdbc,parents.getFirst()),order.id());
            } else {
                jdbc.update("update receiving_order set plan_receiving_date_time=? where id=?",now.toLocalDateTime(),order.id());
                if(emptyParty) jdbc.update("update receiving_order set consignor=? where id=?",PartyReferences.clientName(jdbc,parents.getFirst()),order.id());
            }
            if(order.route()==null) {
                boolean auto=order.transport()==TransportType.VEHICLE;
                routes.create(new CreateRouteRequest(shipping?RouteType.SHIPPING:RouteType.RECEIVING,now,order.area(),order.transport(),
                        auto?carrier:null,auto?driver:null,auto?vehicle:null,null,List.of(order.id())));
            }
        }
        return orders.findById(id);
    }

    private UUID first(String kind,String label) {
        var entries=catalogs.list(kind,true);
        if(entries.isEmpty()) throw new ApiException(HttpStatus.CONFLICT,"AUTO_ROUTE_CATALOG_EMPTY","Добавьте активного "+label+" в справочник для автоматического создания рейса");
        return entries.getFirst().id();
    }
}

@RestController
@RequestMapping("/api/comprehensive-service-orders/{id}/prepare-transport")
class ServiceTransportPreparationController {
    private final ServiceTransportPreparation service;
    ServiceTransportPreparationController(ServiceTransportPreparation service){this.service=service;}
    @PostMapping
    public ComprehensiveServiceOrderDetails prepare(@PathVariable UUID id,@Valid @RequestBody ServiceTransportPreparation.Request request) {
        return service.prepare(id,request.section());
    }
}
