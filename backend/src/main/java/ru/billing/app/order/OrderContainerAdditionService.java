package ru.billing.app.order;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.billing.app.error.ApiException;
import ru.billing.app.reference.ReferenceDataService;

@Service
public class OrderContainerAdditionService {
    private final JdbcTemplate jdbc;
    private final ReceivingOrderStore receiving;
    private final ShippingOrderStore shipping;
    private final ReferenceDataService references;
    private final OrderRequestValidator validator;

    public OrderContainerAdditionService(JdbcTemplate jdbc, ReceivingOrderStore receiving, ShippingOrderStore shipping,
            ReferenceDataService references, OrderRequestValidator validator) {
        this.jdbc=jdbc; this.receiving=receiving; this.shipping=shipping; this.references=references; this.validator=validator;
    }

    @Transactional
    public void add(boolean incoming, UUID id, List<UpdateOrderContainersRequest.Addition> additions) {
        if(additions.isEmpty()) return;
        String table=incoming?"receiving_order":"shipping_order";
        var locked=jdbc.query("select id from "+table+" where id=? for update",(rs,n)->rs.getObject(1,UUID.class),id);
        if(locked.isEmpty()) throw error(HttpStatus.NOT_FOUND,"ORDER_NOT_FOUND","Заявка не найдена");
        OrderDetails order=incoming?receiving.findById(id):shipping.findById(id);
        if(!"DRAFT".equals(order.status())) throw error(HttpStatus.CONFLICT,"CONTAINER_ATTRIBUTES_NOT_EDITABLE","Добавлять КТК можно только в черновике");
        if(order.comprehensiveServiceOrderId()!=null || order.sourceReceivingOrderId()!=null || order.sourceShippingOrderId()!=null
                || incoming && order.transportType()!=TransportType.VEHICLE)
            throw error(HttpStatus.CONFLICT,"CONTAINER_COMPOSITION_FROM_SOURCE","Состав КТК этой заявки изменяется через исходную поставку или накладные");

        boolean railway=order.transportType()==TransportType.RAILWAY;
        var containers=new ArrayList<>(order.containers().stream().map(OrderContainerAdditionService::request).toList());
        var carriages=new LinkedHashMap<UUID,List<OrderContainerRequest>>();
        for(var carriage:order.railwayCarriages()) carriages.put(carriage.railwayCarriageId(),new ArrayList<>(carriage.containers().stream().map(OrderContainerAdditionService::request).toList()));
        for(var addition:additions) {
            if(railway) {
                if(addition.railwayCarriageId()==null || !carriages.containsKey(addition.railwayCarriageId()))
                    throw error(HttpStatus.BAD_REQUEST,"ORDER_CARRIAGE_REQUIRED","Выберите вагон, который уже включён в эту заявку");
                carriages.get(addition.railwayCarriageId()).add(addition.container());
            } else {
                if(addition.railwayCarriageId()!=null) throw error(HttpStatus.BAD_REQUEST,"RAILWAY_CARRIAGES_NOT_ALLOWED_FOR_VEHICLE","Для автозаявки вагон не указывается");
                containers.add(addition.container());
            }
        }
        var combined=new CreateOrderRequest(order.clientId(),order.contractId(),order.terminalArea().id(),order.transportType(),
            containers,List.of(),carriages.entrySet().stream().map(entry->new ShippingOrderRailwayCarriageRequest(entry.getKey(),entry.getValue())).toList(),FillingType.ALL,List.of(),List.of());
        if(incoming) validator.validate(combined); else validator.validateShipping(combined);
        if(railway) references.validateShippingRailwayReferences(combined); else references.validateReferences(combined);
        if(!incoming&&!railway) references.validateVehicleShippingCapacity(containers);
        for(var addition:additions) {
            var c=addition.container(); references.validateContainerAttributes(incoming?c.ownerClientId():null,c.sealTypeId(),c.hazardClassId());
        }
        // All validation completes before insertion; the caller's metadata PATCH shares this transaction.
        for(var addition:additions) {
            if(incoming) receiving.insertContainer(id,addition.container(),order.defaultContainerOwnerId());
            else {
                UUID carriageRow=railway?jdbc.queryForObject("select id from shipping_order_railway_carriage where shipping_order_id=? and railway_carriage_id=?",UUID.class,id,addition.railwayCarriageId()):null;
                shipping.insertContainer(id,carriageRow,addition.container());
            }
        }
    }

    private static OrderContainerRequest request(OrderContainerDetails c) {
        var items=c.cargoItems().stream().map(item->new CargoRequest(item.etsngCodeId(),item.weight())).toList();
        return new OrderContainerRequest(c.containerId(),c.empty(),items.isEmpty()?null:items.getFirst(),c.ownerClientId(),c.sealNumbers(),c.sealTypeId(),c.hazardClassId(),items);
    }
    private static ApiException error(HttpStatus status,String code,String message){return new ApiException(status,code,message);}
}
