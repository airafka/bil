package ru.billing.app.waybill;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class WaybillStoreTest {
 private final UUID nonDangerous = UUID.randomUUID();
 @org.junit.jupiter.api.BeforeEach void seedResolver() {
  when(jdbc.query(eq("select id from danger_product where identifier = ?"), org.mockito.ArgumentMatchers.<org.springframework.jdbc.core.RowMapper<UUID>>any(), eq(-1))).thenReturn(List.of(nonDangerous));
 }

 @Test void keepsAnArbitraryOwnerAsTextWithoutLookingUpAClient() {
  var containerId = UUID.randomUUID();
  var row = new WaybillContainerRequest(containerId,new BigDecimal("6000"),null,null,null,null,new BigDecimal("1500"),"  Владелец вне справочника  ");
  var request = new WaybillValidator().normalizeAndValidate(new CreateWaybillRequest(null,1,2,"P",cargo,List.of(new WaybillRailwayCarriageRequest(UUID.randomUUID(),List.of(row)))));
  new WaybillStore(jdbc).create(request);
  verify(jdbc).update(startsWith("insert into waybill_container"),any(UUID.class),any(UUID.class),eq(containerId),eq(new BigDecimal("6000")),eq(new BigDecimal("1500")),eq("Владелец вне справочника"));
  verify(jdbc,never()).queryForObject(contains("from client"),eq(String.class),any(UUID.class));
 }
 private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
 private final UUID cargo = UUID.randomUUID();
 private CreateWaybillRequest request(String gross, BigDecimal net) {
  when(jdbc.queryForObject(startsWith("select weight"), eq(BigDecimal.class), any(UUID.class))).thenReturn(new BigDecimal("3200"));
  var container = new WaybillContainerRequest(UUID.randomUUID(), new BigDecimal(gross), null, null, null, null, net);
  return new WaybillValidator().normalizeAndValidate(new CreateWaybillRequest(null,1,2,"P",cargo,List.of(new WaybillRailwayCarriageRequest(UUID.randomUUID(),List.of(container)))));
 }
 @Test void persistsExplicitNetWithoutRecalculatingItFromReferenceTare() {
  new WaybillStore(jdbc).create(request("5000",new BigDecimal("1500")));
  verify(jdbc).update(startsWith("insert into waybill_container"),any(UUID.class),any(UUID.class),any(UUID.class),eq(new BigDecimal("5000")),eq(new BigDecimal("1500")),isNull());
  verify(jdbc).update(startsWith("insert into waybill_product"),any(UUID.class),any(UUID.class),eq(cargo),isNull(),eq(new BigDecimal("1500")),eq(nonDangerous));
 }
 @Test void emptyWaybillStillPersistsItsProduct() {
  new WaybillStore(jdbc).create(request("3200",BigDecimal.ZERO));
  verify(jdbc).update(startsWith("insert into waybill_product"),any(UUID.class),any(UUID.class),eq(cargo),isNull(),eq(BigDecimal.ZERO),eq(nonDangerous));
 }
 @Test void legacyGrossOnlyInputGetsASnapshotOfCalculatedNet() {
  new WaybillStore(jdbc).create(request("5000.125",null));
  verify(jdbc).update(startsWith("insert into waybill_product"),any(UUID.class),any(UUID.class),eq(cargo),isNull(),eq(new BigDecimal("1800.125")),eq(nonDangerous));
 }
}
