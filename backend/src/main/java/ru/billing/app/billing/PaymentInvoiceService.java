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

    public record UpdateRequest(@NotNull UUID clientId, @NotNull UUID contractId,
            @NotNull @Pattern(regexp = "[0-9]{4}-(0[1-9]|1[0-2])") String period,
            @NotEmpty @Size(max = 10000) List<@NotNull UUID> chargeIds, @NotNull Integer version) {}
    public record PayRequest(@NotNull Integer version) {}

    public record Line(UUID id, OffsetDateTime performedAt, UUID comprehensiveServiceOrderId, int comprehensiveServiceOrderCode,
            String containerName, String serviceName, BigDecimal amountWithoutVat, BigDecimal amountWithVat, UUID tariffId) {}
    public record CandidatePage(List<Line> items, String timeZone) {}
    public record Invoice(UUID id, int code, UUID clientId, UUID contractId, String clientName,
            String contractName, String period, String timeZone, String status, String currency,
            BigDecimal amountWithoutVat, BigDecimal amountWithVat, OffsetDateTime createdAt, int version, OffsetDateTime paidAt) {}
    public record Details(Invoice invoice, List<Line> items) {}
    private record Party(String clientName, String contractName) {}

    private static final String HEADER_SELECT = """
            select id, code, client_id, contract_id, client_name, contract_name, billing_month,
                   billing_time_zone, status, currency, amount_without_vat, amount_with_vat, created_at, version, paid_at
            from payment_invoice
            """;
    private static final String CANDIDATE_SELECT = """
            select b.id, b.performed_at, e.comprehensive_service_order_id, s.code as comprehensive_service_order_code,
                   k.code as container_name, cat.name as service_name, b.amount_without_vat, b.amount_with_vat, e.tariff_id
            from billing_charge b
            join service_execution e on e.id=b.service_execution_id
            join comprehensive_service_order s on s.id=e.comprehensive_service_order_id
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
                select c.name, ct.name from contract ct join client c on c.id=ct.client_id
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
                insert into payment_invoice_line(id,invoice_id,billing_charge_id,performed_at,comprehensive_service_order_id,
                    comprehensive_service_order_code,container_name,service_name,amount_without_vat,amount_with_vat)
                values(?,?,?,?,?,?,?,?,?,?)
                """, UUID.randomUUID(),id,line.id(),line.performedAt(),line.comprehensiveServiceOrderId(),line.comprehensiveServiceOrderCode(),
                line.containerName(),line.serviceName(),line.amountWithoutVat(),line.amountWithVat());
        return details(id);
    }

    private Invoice lockInvoice(UUID id) {
        var rows = jdbc.query(HEADER_SELECT + " where id=? for update", PaymentInvoiceService::invoice, id);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Счёт не найден");
        return rows.getFirst();
    }
    private static void requireDraft(Invoice invoice) {
        if (!"DRAFT".equals(invoice.status())) throw new ApiException(HttpStatus.CONFLICT, "INVOICE_READ_ONLY", "Оплаченный счёт нельзя изменить или удалить");
    }
    private static void requireVersion(Invoice invoice, int version) {
        if (invoice.version() != version) throw new ApiException(HttpStatus.CONFLICT, "INVOICE_VERSION_CONFLICT", "Счёт уже изменён в другой вкладке. Обновите счёт перед сохранением");
    }
    private static String editableSelect() {
        return CANDIDATE_SELECT.replace("l.billing_charge_id=b.id)", "l.billing_charge_id=b.id and l.invoice_id<>?)");
    }
    @Transactional(readOnly = true)
    public CandidatePage editCandidates(UUID id, UUID client, UUID contract, String period) {
        var current = details(id);
        requireDraft(current.invoice());
        YearMonth month = parsePeriod(period);
        party(client, contract);
        var args = filterArgs(client, contract, month); args.add(id);
        var existing = current.items().stream().collect(java.util.stream.Collectors.toMap(Line::id, item -> item));
        var lines = jdbc.query(editableSelect() + " order by b.performed_at,b.id", PaymentInvoiceService::line, args.toArray());
        return new CandidatePage(lines.stream().map(item -> existing.getOrDefault(item.id(), item)).toList(), zone.getId());
    }
    @Transactional
    public Details update(UUID id, UpdateRequest request) {
        Invoice invoice = lockInvoice(id);
        requireDraft(invoice); requireVersion(invoice, request.version());
        YearMonth month = parsePeriod(request.period());
        if (new HashSet<>(request.chargeIds()).size() != request.chargeIds().size())
            throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_INVOICE_CHARGE", "В списке повторяются оказанные услуги");
        Party party = party(request.clientId(), request.contractId());
        var previous = details(id).items().stream().collect(java.util.stream.Collectors.toMap(Line::id, item -> item));
        var all = new HashSet<>(previous.keySet()); all.addAll(request.chargeIds());
        String locks = String.join(",", Collections.nCopies(all.size(), "?"));
        jdbc.query("select id from billing_charge where id in (" + locks + ") order by id for update", (rs, row) -> rs.getObject(1, UUID.class), all.toArray());
        var args = filterArgs(request.clientId(), request.contractId(), month); args.add(id); args.addAll(request.chargeIds());
        String selected = String.join(",", Collections.nCopies(request.chargeIds().size(), "?"));
        var lines = jdbc.query(editableSelect() + " and b.id in (" + selected + ") order by b.performed_at,b.id", PaymentInvoiceService::line, args.toArray());
        if (lines.size() != request.chargeIds().size()) throw unavailable();
        // Keep the original snapshots of retained rows. Only new charges acquire new invoice snapshots.
        var finalLines = lines.stream().map(item -> previous.getOrDefault(item.id(), item)).toList();
        BigDecimal withoutVat = finalLines.stream().map(Line::amountWithoutVat).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal withVat = finalLines.stream().map(Line::amountWithVat).reduce(BigDecimal.ZERO, BigDecimal::add);
        for (UUID old : previous.keySet()) if (!request.chargeIds().contains(old))
            jdbc.update("delete from payment_invoice_line where invoice_id=? and billing_charge_id=?", id, old);
        for (Line line : finalLines) if (!previous.containsKey(line.id())) jdbc.update("""
                insert into payment_invoice_line(id,invoice_id,billing_charge_id,performed_at,comprehensive_service_order_id,
                    comprehensive_service_order_code,container_name,service_name,amount_without_vat,amount_with_vat)
                values(?,?,?,?,?,?,?,?,?,?)
                """, UUID.randomUUID(),id,line.id(),line.performedAt(),line.comprehensiveServiceOrderId(),line.comprehensiveServiceOrderCode(),
                line.containerName(),line.serviceName(),line.amountWithoutVat(),line.amountWithVat());
        jdbc.update("""
                update payment_invoice set client_id=?,contract_id=?,client_name=?,contract_name=?,billing_month=?,
                    billing_time_zone=?,amount_without_vat=?,amount_with_vat=?,version=version+1 where id=?
                """,request.clientId(),request.contractId(),party.clientName(),party.contractName(),month.atDay(1),zone.getId(),withoutVat,withVat,id);
        return details(id);
    }
    @Transactional
    public Details pay(UUID id, PayRequest request) {
        Invoice invoice = lockInvoice(id);
        if ("PAID".equals(invoice.status())) return details(id);
        requireDraft(invoice); requireVersion(invoice, request.version());
        if (details(id).items().isEmpty()) throw new ApiException(HttpStatus.CONFLICT, "EMPTY_INVOICE", "В счёте нет услуг");
        jdbc.update("update payment_invoice set status='PAID',paid_at=current_timestamp,version=version+1 where id=?", id);
        return details(id);
    }

    public record AppliedTariff(UUID tariffId, UUID complexServiceId, String serviceName,
            String clientName, String contractName, String containerName, int invoiceCode,
            int comprehensiveServiceOrderCode, UUID comprehensiveServiceOrderId, OffsetDateTime performedAt,
            BigDecimal coefficient, BigDecimal basePriceWithoutVat, BigDecimal basePriceWithVat,
            BigDecimal priceWithoutVat, BigDecimal priceWithVat, String timeZone) {}

    @Transactional(readOnly = true)
    public AppliedTariff appliedTariff(UUID invoiceId, UUID chargeId) {
        // Read the execution snapshot, never the current catalog coefficient or price.
        var rows = jdbc.query("""
                select e.tariff_id,e.complex_service_id,l.service_name,i.client_name,i.contract_name,
                       l.container_name,i.code,l.comprehensive_service_order_code,l.comprehensive_service_order_id,
                       l.performed_at,e.coefficient,e.base_price_without_vat,e.base_price_with_vat,
                       e.price_without_vat,e.price_with_vat,i.billing_time_zone
                from payment_invoice_line l
                join payment_invoice i on i.id=l.invoice_id
                join billing_charge b on b.id=l.billing_charge_id
                join service_execution e on e.id=b.service_execution_id
                where l.invoice_id=? and l.billing_charge_id=? and e.tariff_id is not null
                """, (rs, row) -> new AppliedTariff(rs.getObject("tariff_id", UUID.class),
                rs.getObject("complex_service_id", UUID.class),rs.getString("service_name"),
                rs.getString("client_name"),rs.getString("contract_name"),rs.getString("container_name"),
                rs.getInt("code"),rs.getInt("comprehensive_service_order_code"),
                rs.getObject("comprehensive_service_order_id", UUID.class),rs.getObject("performed_at", OffsetDateTime.class),
                rs.getBigDecimal("coefficient"),rs.getBigDecimal("base_price_without_vat"),rs.getBigDecimal("base_price_with_vat"),
                rs.getBigDecimal("price_without_vat"),rs.getBigDecimal("price_with_vat"),rs.getString("billing_time_zone")), invoiceId, chargeId);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "INVOICE_TARIFF_NOT_FOUND", "Тариф для этой строки счёта не найден");
        return rows.getFirst();
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
                select l.billing_charge_id as id, l.performed_at, l.comprehensive_service_order_id, l.comprehensive_service_order_code,
                       l.container_name,l.service_name,l.amount_without_vat,l.amount_with_vat,e.tariff_id
                from payment_invoice_line l
                join billing_charge b on b.id=l.billing_charge_id
                join service_execution e on e.id=b.service_execution_id
                where l.invoice_id=? order by l.performed_at,l.billing_charge_id
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
        requireDraft(lockInvoice(id));
        if (jdbc.update("delete from payment_invoice where id=? and status='DRAFT'", id) != 1)
            throw new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Черновик счёта не найден");
    }

    private static Line line(ResultSet rs, int row) throws SQLException {
        return new Line(rs.getObject("id", UUID.class),rs.getObject("performed_at", OffsetDateTime.class),
                rs.getObject("comprehensive_service_order_id", UUID.class),rs.getInt("comprehensive_service_order_code"),rs.getString("container_name"),
                rs.getString("service_name"),rs.getBigDecimal("amount_without_vat"),rs.getBigDecimal("amount_with_vat"),rs.getObject("tariff_id", UUID.class));
    }
    private static Invoice invoice(ResultSet rs, int row) throws SQLException {
        return new Invoice(rs.getObject("id", UUID.class),rs.getInt("code"),rs.getObject("client_id", UUID.class),
                rs.getObject("contract_id", UUID.class),rs.getString("client_name"),rs.getString("contract_name"),
                YearMonth.from(rs.getObject("billing_month", LocalDate.class)).toString(),rs.getString("billing_time_zone"),
                rs.getString("status"),rs.getString("currency"),rs.getBigDecimal("amount_without_vat"),
                rs.getBigDecimal("amount_with_vat"),rs.getObject("created_at", OffsetDateTime.class),rs.getInt("version"),rs.getObject("paid_at", OffsetDateTime.class));
    }
}
