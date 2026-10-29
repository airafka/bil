package ru.billing.app.billing;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.PagedResponse;

@Service
public class PaymentInvoiceService {
    private final JdbcTemplate jdbc;
    private final ZoneId zone;

    public PaymentInvoiceService(JdbcTemplate jdbc,
            @Value("${app.billing.time-zone:Europe/Moscow}") String timeZone) {
        this.jdbc = jdbc;
        this.zone = ZoneId.of(timeZone);
    }

    public record CreateRequest(
            @NotNull UUID clientId, @NotNull UUID contractId,
            @NotNull @Pattern(regexp = "[0-9]{4}-(0[1-9]|1[0-2])") String period,
            @NotEmpty @Size(max = 10000) List<@NotNull UUID> chargeIds,
            @NotNull UUID requestKey) {}

    public record Line(UUID id, OffsetDateTime performedAt, UUID serviceOrderId, int serviceOrderCode,
            String containerName, String serviceName, BigDecimal amountWithoutVat, BigDecimal amountWithVat) {}
    public record CandidatePage(List<Line> items, String timeZone) {}
    public record Invoice(UUID id, int code, UUID clientId, UUID contractId, String clientName,
            String contractName, String period, String timeZone, String status, String currency,
            BigDecimal amountWithoutVat, BigDecimal amountWithVat, OffsetDateTime createdAt) {}
    public record Details(Invoice invoice, List<Line> items) {}
    private record Party(String clientName, String contractName) {}

    private static final String HEADER_SELECT = """
            select id, code, client_id, contract_id, client_name, contract_name, billing_month,
                   billing_time_zone, status, currency, amount_without_vat, amount_with_vat, created_at
            from payment_invoice
            """;
    private static final String CANDIDATE_SELECT = """
            select b.id, b.performed_at, e.service_order_id, s.code as service_order_code,
                   k.code as container_name, cat.name as service_name, b.amount_without_vat, b.amount_with_vat
            from billing_charge b
            join service_execution e on e.id=b.service_execution_id
            join service_order s on s.id=e.service_order_id
            join container k on k.id=e.container_id
            join complex_service_catalog cat on cat.id=e.complex_service_id
            where b.client_id=? and b.contract_id=? and b.performed_at>=? and b.performed_at<?
                  and b.currency='RUB' and e.status='PERFORMED'
                  and not exists (select 1 from payment_invoice_line l where l.billing_charge_id=b.id)
            """;

    static YearMonth parsePeriod(String period) {
        try {
            if (period == null || !period.matches("[0-9]{4}-(0[1-9]|1[0-2])")) throw new DateTimeParseException("Invalid period", "", 0);
            YearMonth value = YearMonth.parse(period);
            if (value.getYear() < 1 || value.getYear() > 9998) throw new DateTimeParseException("Invalid year", period, 0);
            return value;
        } catch (DateTimeParseException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INVOICE_PERIOD", "Укажите корректные месяц и год");
        }
    }

    private List<Object> filterArgs(UUID client, UUID contract, YearMonth month) {
        return new ArrayList<>(List.of(client, contract,
                month.atDay(1).atStartOfDay(zone).toOffsetDateTime(),
                month.plusMonths(1).atDay(1).atStartOfDay(zone).toOffsetDateTime()));
    }

    private Party party(UUID client, UUID contract) {
        var values = jdbc.query("""
                select c.code, ct.name from contract ct join client c on c.id=ct.client_id
                where ct.id=? and c.id=?
                """, (rs, row) -> new Party(rs.getString(1), rs.getString(2)), contract, client);
        if (values.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVOICE_CONTRACT_MISMATCH", "Выберите договор указанного клиента");
        return values.getFirst();
    }

    @Transactional(readOnly = true)
    public CandidatePage candidates(UUID client, UUID contract, String period) {
        YearMonth month = parsePeriod(period);
        party(client, contract);
        return new CandidatePage(jdbc.query(CANDIDATE_SELECT + " order by b.performed_at,b.id",
                PaymentInvoiceService::line, filterArgs(client, contract, month).toArray()), zone.getId());
    }

    @Transactional
    public Details create(CreateRequest request) {
        YearMonth month = parsePeriod(request.period());
        if (new HashSet<>(request.chargeIds()).size() != request.chargeIds().size())
            throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_INVOICE_CHARGE", "В списке повторяются оказанные услуги");

        // Serialize retries of the same request. A lost HTTP response must not create a second invoice.
        jdbc.query("select pg_advisory_xact_lock(hashtextextended(cast(? as text), 0))",
                (rs, row) -> 0, request.requestKey().toString());
        var existing = jdbc.query(HEADER_SELECT + " where request_key=?", PaymentInvoiceService::invoice, request.requestKey());
        if (!existing.isEmpty()) {
            Details previous = details(existing.getFirst().id());
            if (!previous.invoice().clientId().equals(request.clientId())
                    || !previous.invoice().contractId().equals(request.contractId())
                    || !previous.invoice().period().equals(request.period())
                    || !new HashSet<>(previous.items().stream().map(Line::id).toList()).equals(new HashSet<>(request.chargeIds())))
                throw new ApiException(HttpStatus.CONFLICT, "INVOICE_REQUEST_REUSED", "Этот запрос уже использован для другого состава счёта");
            return previous;
        }
        Party party = party(request.clientId(), request.contractId());
        String placeholders = String.join(",", Collections.nCopies(request.chargeIds().size(), "?"));
        // Lock in a stable order; recheck availability in a fresh statement after acquiring locks.
        var locked = jdbc.query("select id from billing_charge where id in (" + placeholders + ") order by id for update",
                (rs, row) -> rs.getObject(1, UUID.class), request.chargeIds().toArray());
        if (locked.size() != request.chargeIds().size()) throw unavailable();
        var parameters = filterArgs(request.clientId(), request.contractId(), month);
        parameters.addAll(request.chargeIds());
        var lines = jdbc.query(CANDIDATE_SELECT + " and b.id in (" + placeholders + ") order by b.performed_at,b.id",
                PaymentInvoiceService::line, parameters.toArray());
        if (lines.size() != request.chargeIds().size()) throw unavailable();

        BigDecimal withoutVat = lines.stream().map(Line::amountWithoutVat).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal withVat = lines.stream().map(Line::amountWithVat).reduce(BigDecimal.ZERO, BigDecimal::add);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into payment_invoice(id,request_key,client_id,contract_id,client_name,contract_name,
                    billing_month,billing_time_zone,currency,amount_without_vat,amount_with_vat)
                values(?,?,?,?,?,?,?,?,'RUB',?,?)
                """, id,request.requestKey(),request.clientId(),request.contractId(),party.clientName(),party.contractName(),
                month.atDay(1),zone.getId(),withoutVat,withVat);
        for (Line line : lines) jdbc.update("""
                insert into payment_invoice_line(id,invoice_id,billing_charge_id,performed_at,service_order_id,
                    service_order_code,container_name,service_name,amount_without_vat,amount_with_vat)
                values(?,?,?,?,?,?,?,?,?,?)
                """, UUID.randomUUID(),id,line.id(),line.performedAt(),line.serviceOrderId(),line.serviceOrderCode(),
                line.containerName(),line.serviceName(),line.amountWithoutVat(),line.amountWithVat());
        return details(id);
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.CONFLICT, "INVOICE_CHARGES_UNAVAILABLE",
                "Часть услуг уже включена в другой счёт или не соответствует фильтрам. Обновите список и повторите выбор.");
    }

    @Transactional(readOnly = true)
    public Details details(UUID id) {
        var headers = jdbc.query(HEADER_SELECT + " where id=?", PaymentInvoiceService::invoice, id);
        if (headers.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Счёт не найден");
        var lines = jdbc.query("""
                select billing_charge_id as id, performed_at, service_order_id, service_order_code,
                       container_name,service_name,amount_without_vat,amount_with_vat
                from payment_invoice_line where invoice_id=? order by performed_at,billing_charge_id
                """, PaymentInvoiceService::line, id);
        return new Details(headers.getFirst(), lines);
    }

    @Transactional(readOnly = true)
    public PagedResponse<Invoice> list(int page, int size) {
        page = Math.max(page, 0);
        size = Math.max(1, Math.min(size, 100));
        long total = jdbc.queryForObject("select count(*) from payment_invoice", Long.class);
        return PagedResponse.of(jdbc.query(HEADER_SELECT + " order by code desc limit ? offset ?",
                PaymentInvoiceService::invoice, size, (long) page * size), page, size, total);
    }

    @Transactional
    public void delete(UUID id) {
        if (jdbc.update("delete from payment_invoice where id=? and status='DRAFT'", id) != 1)
            throw new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Черновик счёта не найден");
    }

    private static Line line(ResultSet rs, int row) throws SQLException {
        return new Line(rs.getObject("id", UUID.class),rs.getObject("performed_at", OffsetDateTime.class),
                rs.getObject("service_order_id", UUID.class),rs.getInt("service_order_code"),rs.getString("container_name"),
                rs.getString("service_name"),rs.getBigDecimal("amount_without_vat"),rs.getBigDecimal("amount_with_vat"));
    }
    private static Invoice invoice(ResultSet rs, int row) throws SQLException {
        return new Invoice(rs.getObject("id", UUID.class),rs.getInt("code"),rs.getObject("client_id", UUID.class),
                rs.getObject("contract_id", UUID.class),rs.getString("client_name"),rs.getString("contract_name"),
                YearMonth.from(rs.getObject("billing_month", LocalDate.class)).toString(),rs.getString("billing_time_zone"),
                rs.getString("status"),rs.getString("currency"),rs.getBigDecimal("amount_without_vat"),
                rs.getBigDecimal("amount_with_vat"),rs.getObject("created_at", OffsetDateTime.class));
    }
}
