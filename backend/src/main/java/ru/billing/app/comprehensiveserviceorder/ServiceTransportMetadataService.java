package ru.billing.app.comprehensiveserviceorder;
import java.util.*;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import ru.billing.app.error.ApiException;
import ru.billing.app.reference.PartyReferences;

@Service
public class ServiceTransportMetadataService {
 private final JdbcTemplate jdbc;
 private final ComprehensiveServiceOrderService orders;
 public ServiceTransportMetadataService(JdbcTemplate jdbc,ComprehensiveServiceOrderService orders){this.jdbc=jdbc;this.orders=orders;}
 private static String clean(String s){return s==null||s.isBlank()?null:s.trim();}
 private record Current(int number,String status,LocalDateTime plannedAt,String partyName) {}
 @Transactional
 public ComprehensiveServiceOrderDetails update(UUID serviceId,UpdateServiceTransportMetadataRequest request){
  ServiceOrderLock.lock(jdbc,serviceId);
  if(jdbc.queryForList("select id from comprehensive_service_order where id=? for update",serviceId).isEmpty())
   throw new ApiException(HttpStatus.NOT_FOUND,"COMPREHENSIVE_SERVICE_ORDER_NOT_FOUND","Заявка на услугу не найдена");
  var seen=new HashSet<String>();
  var items=request.orders().stream().sorted(Comparator.comparing(UpdateServiceTransportMetadataRequest.Item::id).thenComparing(UpdateServiceTransportMetadataRequest.Item::kind)).toList();
  for(var item:items){
   if(!seen.add(item.kind()+":"+item.id()))throw new ApiException(HttpStatus.BAD_REQUEST,"DUPLICATE_ORDER","Заявка в списке изменений повторяется");
   boolean shipping=item.kind()==UpdateServiceTransportMetadataRequest.Kind.SHIPPING;
   String query=shipping?"select o.number,o.order_status,o.planned_shipping_date_time as planned_at,(select name from client_related_entity where id=o.consignee_id) as party_name from shipping_order o where o.id=? and o.comprehensive_service_order_id=? for update of o"
     :"select o.number,o.order_status,o.plan_receiving_date_time as planned_at,o.consignor as party_name from receiving_order o where o.id=? and o.comprehensive_service_order_id=? and o.service_role=? for update of o";
   var rows=jdbc.query(query,(rs,n)->new Current(rs.getInt("number"),rs.getString("order_status"),rs.getObject("planned_at",LocalDateTime.class),rs.getString("party_name")),shipping ? new Object[]{item.id(),serviceId} : new Object[]{item.id(),serviceId,item.kind().name()});
   if(rows.isEmpty())throw new ApiException(HttpStatus.CONFLICT,"SERVICE_ORDER_NOT_AVAILABLE","Выбранная заявка не относится к поставкам, вывозам или возвратам этой услуги");
   var current=rows.getFirst();
   if(!"DRAFT".equals(current.status()))throw new ApiException(HttpStatus.CONFLICT,"ORDER_NOT_DRAFT","Заявка "+current.number()+" уже не является черновиком. Изменения не сохранены");
   if(!Objects.equals(current.plannedAt(),item.originalPlannedAt())||!Objects.equals(clean(current.partyName()),clean(item.originalPartyName())))
    throw new ApiException(HttpStatus.CONFLICT,"ORDER_METADATA_CHANGED","Реквизиты заявки "+current.number()+" уже изменены. Отмените редактирование и откройте его снова");
  }
  // Validate and lock every document before writing, so the entire form saves atomically.
  for(var item:items){
   if(item.kind()==UpdateServiceTransportMetadataRequest.Kind.SHIPPING)
    jdbc.update("update shipping_order set planned_shipping_date_time=?,consignee_id=? where id=?",item.plannedAt(),PartyReferences.clientParty(jdbc,clean(item.partyName())),item.id());
   else jdbc.update("update receiving_order set plan_receiving_date_time=?,consignor=? where id=?",item.plannedAt(),PartyReferences.clientName(jdbc,item.partyName()),item.id());
  }
  return orders.findById(serviceId);
 }
}
