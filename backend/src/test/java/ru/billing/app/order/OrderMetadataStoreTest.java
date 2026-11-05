package ru.billing.app.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.sql.ResultSet;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class OrderMetadataStoreTest {
    private final LocalDateTime arrival = LocalDateTime.of(2026, 10, 29, 10, 45);
    private final LocalDateTime departure = LocalDateTime.of(2026, 10, 30, 15, 20);

    private CreateOrderRequest request() {
        return new CreateOrderRequest(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                TransportType.VEHICLE, List.of(), List.of(), List.of(), FillingType.ALL,
                List.of(), List.of(), null, arrival, "  Отправитель  ", departure, "  Получатель  ");
    }

    @Test
    void storesArrivalAndConsignorOnReceivingHeader() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(42);
        when(jdbc.queryForList(contains("select name from client"), eq(String.class), any(Object[].class))).thenAnswer(call -> List.of(call.getArgument(2, String.class)));
        CreateOrderRequest request = request();
        new ReceivingOrderStore(jdbc).createVehicle(request.withDefaultContainerOwner(request.clientId()));
        verify(jdbc).queryForObject(contains("order_status, plan_receiving_date_time, consignor"), eq(Integer.class),
                any(UUID.class), eq(request.clientId()), eq(request.terminalAreaId()), eq("VEHICLE"),
                eq(request.contractId()), eq(arrival), eq("Отправитель"), eq(request.clientId()), isNull(), isNull(), isNull(), isNull(), isNull());
    }

    @Test
    void validatesAndPreservesReceivingContactsWhenSelectingOwner() {
        CreateOrderRequest base = request();
        CreateOrderRequest contact = new CreateOrderRequest(base.clientId(), base.contractId(), base.terminalAreaId(),
                TransportType.VEHICLE, List.of(), List.of(), List.of(), FillingType.ALL, List.of(), List.of(),
                null, arrival, "Отправитель", null, null, base.clientId(), "  Иванов  ", " +7 999 123-45-67 ", " bad-email ", " Комментарий ");
        assertThat(contact.withDefaultContainerOwner(UUID.randomUUID()).authorizedRepresentative()).isEqualTo("Иванов");
        assertThat(contact.phone()).isEqualTo("+7 999 123-45-67");
        assertThat(contact.comment()).isEqualTo("Комментарий");
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(contact)).extracting(v -> v.getPropertyPath().toString()).containsExactly("email");
        }
    }

    @Test
    void storesDepartureAndConsigneeOnShippingHeader() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(43);
        when(jdbc.queryForList(contains("select name from client"), eq(String.class), any(Object[].class))).thenAnswer(call -> List.of(call.getArgument(2, String.class)));
        CreateOrderRequest request = request();
        new ShippingOrderStore(jdbc).create(request);
        verify(jdbc).queryForObject(contains("order_status, planned_shipping_date_time, consignee_id"), eq(Integer.class),
                any(UUID.class), eq(request.clientId()), eq(request.terminalAreaId()), eq("VEHICLE"),
                eq(request.contractId()), eq("ALL"), eq(departure), isNull());
    }

    @SuppressWarnings("unchecked")
    private JdbcTemplate detailRows(LocalDateTime time, String party) throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString("transport_type")).thenReturn("VEHICLE");
        when(rs.getString("filling_type")).thenReturn("ALL");
        when(rs.getObject("arrival_at", LocalDateTime.class)).thenReturn(time);
        when(rs.getObject("departure_at", LocalDateTime.class)).thenReturn(time);
        when(rs.getString("consignor")).thenReturn(party);
        when(rs.getString("consignee")).thenReturn(party);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(call -> {
            String sql = call.getArgument(0);
            if (!sql.contains("select o.id, o.number as code")) return List.of();
            RowMapper<?> mapper = call.getArgument(1);
            return List.of(mapper.mapRow(rs, 0));
        });
        return jdbc;
    }

    @Test
    void readsReceivingMetadataAndKeepsShippingMetadataEmpty() throws Exception {
        OrderDetails result = new ReceivingOrderStore(detailRows(arrival, "Отправитель")).findById(UUID.randomUUID());
        assertThat(result.arrivalAt()).isEqualTo(arrival);
        assertThat(result.consignor()).isEqualTo("Отправитель");
        assertThat(result.departureAt()).isNull();
        assertThat(result.consignee()).isNull();
    }

    @Test
    void readsShippingMetadataAndKeepsReceivingMetadataEmpty() throws Exception {
        OrderDetails result = new ShippingOrderStore(detailRows(departure, "Получатель")).findById(UUID.randomUUID());
        assertThat(result.departureAt()).isEqualTo(departure);
        assertThat(result.consignee()).isEqualTo("Получатель");
        assertThat(result.arrivalAt()).isNull();
        assertThat(result.consignor()).isNull();
    }

    @Test
    void readsOldOrdersWithEmptyMetadata() throws Exception {
        UUID id = UUID.randomUUID();
        assertThat(new ReceivingOrderStore(detailRows(null, null)).findById(id).arrivalAt()).isNull();
        assertThat(new ShippingOrderStore(detailRows(null, null)).findById(id).consignee()).isNull();
    }

    @Test
    void rejectsOverlongCargoPartyNamesAndAcceptsMissingMetadata() {
        CreateOrderRequest base = request();
        CreateOrderRequest tooLong = new CreateOrderRequest(base.clientId(), base.contractId(), base.terminalAreaId(),
                TransportType.VEHICLE, List.of(), List.of(), List.of(), FillingType.ALL, List.of(), List.of(),
                null, null, "А".repeat(256), null, "Б".repeat(256));
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(tooLong)).extracting(v -> v.getPropertyPath().toString())
                    .containsExactlyInAnyOrder("consignor", "consignee");
            CreateOrderRequest legacy = new CreateOrderRequest(base.clientId(), base.contractId(), base.terminalAreaId(),
                    TransportType.VEHICLE, List.of(), List.of(), List.of(), FillingType.ALL, List.of(), List.of());
            assertThat(validator.validate(legacy)).isEmpty();
            assertThat(legacy.arrivalAt()).isNull();
            assertThat(legacy.departureAt()).isNull();
        }
    }
}
