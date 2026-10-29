package ru.billing.app.billing;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.sql.ResultSet;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import ru.billing.app.error.ApiException;

class PaymentInvoiceServiceTest {
    private final UUID client = UUID.randomUUID();
    private final UUID contract = UUID.randomUUID();
    private final UUID charge = UUID.randomUUID();
    private final OffsetDateTime performed = OffsetDateTime.parse("2026-05-10T11:30:00+03:00");

    @Test
    void rejectsMalformedPeriodsAndSupportsLeapMonths() {
        assertThat(PaymentInvoiceService.parsePeriod("2028-02")).isEqualTo(YearMonth.of(2028, 2));
        for (String value : new String[] { "2026-13", "2026-00", "2026-5", "0000-01", "9999-12", "May 2026", "2026-05-01" })
            assertThatThrownBy(() -> PaymentInvoiceService.parsePeriod(value)).isInstanceOf(ApiException.class);
    }

    @SuppressWarnings("unchecked")
    private JdbcTemplate jdbc(boolean available) throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString(1)).thenReturn("Клиент");
        when(rs.getString(2)).thenReturn("Договор");
        when(rs.getObject("id", UUID.class)).thenReturn(charge);
        when(rs.getObject("client_id", UUID.class)).thenReturn(client);
        when(rs.getObject("contract_id", UUID.class)).thenReturn(contract);
        when(rs.getObject("service_order_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getObject("performed_at", OffsetDateTime.class)).thenReturn(performed);
        when(rs.getObject("created_at", OffsetDateTime.class)).thenReturn(performed);
        when(rs.getObject("billing_month", LocalDate.class)).thenReturn(LocalDate.of(2026, 5, 1));
        when(rs.getString("container_name")).thenReturn("KTK1234567");
        when(rs.getString("service_name")).thenReturn("Название из справочника");
        when(rs.getBigDecimal("amount_without_vat")).thenReturn(new BigDecimal("123.45"));
        when(rs.getBigDecimal("amount_with_vat")).thenReturn(new BigDecimal("148.14"));
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(call -> {
            String sql = call.getArgument(0);
            if (sql.contains("where request_key")) return List.of();
            if (sql.startsWith("select id from billing_charge")) return List.of(charge);
            if (sql.contains("from billing_charge b") && !available) return List.of();
            RowMapper<?> mapper = call.getArgument(1);
            return List.of(mapper.mapRow(rs, 0));
        });
        return jdbc;
    }

    @Test
    void filtersByHalfOpenMonthInBusinessTimeZone() throws Exception {
        JdbcTemplate jdbc = jdbc(true);
        new PaymentInvoiceService(jdbc, "Europe/Moscow").candidates(client, contract, "2026-05");
        verify(jdbc).query(contains("b.performed_at>=? and b.performed_at<?"), any(RowMapper.class),
                eq(client), eq(contract), eq(OffsetDateTime.parse("2026-05-01T00:00:00+03:00")),
                eq(OffsetDateTime.parse("2026-06-01T00:00:00+03:00")));
    }

    @Test
    void refusesReservedOrOutOfFilterChargesBeforeInsertingAnything() throws Exception {
        JdbcTemplate jdbc = jdbc(false);
        var request = new PaymentInvoiceService.CreateRequest(client, contract, "2026-05", List.of(charge), UUID.randomUUID());
        assertThatThrownBy(() -> new PaymentInvoiceService(jdbc, "Europe/Moscow").create(request))
                .isInstanceOf(ApiException.class).hasMessageContaining("уже включена");
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void snapshotsNamesAndExactSourceAmounts() throws Exception {
        JdbcTemplate jdbc = jdbc(true);
        var request = new PaymentInvoiceService.CreateRequest(client, contract, "2026-05", List.of(charge), UUID.randomUUID());
        var result = new PaymentInvoiceService(jdbc, "Europe/Moscow").create(request);
        assertThat(result.items()).hasSize(1);
        verify(jdbc).update(contains("insert into payment_invoice("), any(UUID.class), eq(request.requestKey()),
                eq(client), eq(contract), eq("Клиент"), eq("Договор"), eq(LocalDate.of(2026, 5, 1)),
                eq("Europe/Moscow"), eq(new BigDecimal("123.45")), eq(new BigDecimal("148.14")));
        verify(jdbc).update(contains("insert into payment_invoice_line("), any(UUID.class), any(UUID.class),
                eq(charge), eq(performed), any(UUID.class), eq(0), eq("KTK1234567"), eq("Название из справочника"),
                eq(new BigDecimal("123.45")), eq(new BigDecimal("148.14")));
    }

    @Test
    void rejectsRepeatedChargeIdsBeforeDatabaseAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var request = new PaymentInvoiceService.CreateRequest(client, contract, "2026-05", List.of(charge, charge), UUID.randomUUID());
        assertThatThrownBy(() -> new PaymentInvoiceService(jdbc, "Europe/Moscow").create(request)).isInstanceOf(ApiException.class);
        verifyNoInteractions(jdbc);
    }

    @Test
    void validatesEmptySelectionAndMissingFilters() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var invalid = new PaymentInvoiceService.CreateRequest(null, null, "2026-13", List.of(), null);
            assertThat(factory.getValidator().validate(invalid)).hasSize(5);
        }
    }
}
