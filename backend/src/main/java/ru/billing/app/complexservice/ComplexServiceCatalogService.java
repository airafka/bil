package ru.billing.app.complexservice;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.billing.app.error.ApiException;

@Service
public class ComplexServiceCatalogService {
    private final JdbcTemplate jdbc;

    public ComplexServiceCatalogService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public List<ComplexServiceSummary> findAll() {
        return jdbc.query("""
                select s.id, s.name, s.price_without_vat, s.price_with_vat,
                       (select count(*) from complex_service_tariff t where t.complex_service_id = s.id) as tariff_count
                from complex_service_catalog s order by s.name
                """, (rs, row) -> new ComplexServiceSummary(rs.getObject("id", UUID.class),
                        rs.getString("name"), rs.getBigDecimal("price_without_vat"),
                        rs.getBigDecimal("price_with_vat"), rs.getInt("tariff_count")));
    }

    @Transactional(readOnly = true)
    public ComplexServiceDetails findById(UUID id) {
        List<ComplexServiceSummary> services = jdbc.query("""
                select s.id, s.name, s.price_without_vat, s.price_with_vat,
                       (select count(*) from complex_service_tariff t where t.complex_service_id = s.id) as tariff_count
                from complex_service_catalog s where s.id = ?
                """, (rs, row) -> new ComplexServiceSummary(rs.getObject("id", UUID.class),
                        rs.getString("name"), rs.getBigDecimal("price_without_vat"),
                        rs.getBigDecimal("price_with_vat"), rs.getInt("tariff_count")), id);
        if (services.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,
                "COMPLEX_SERVICE_NOT_FOUND", "Комплексная услуга не найдена");
        ComplexServiceSummary base = services.getFirst();
        List<ComplexServiceTariff> tariffs = jdbc.query("""
                select t.id, t.client_id, c.name as client_name, t.contract_id,
                       ct.name as contract_name, t.coefficient, t.active
                from complex_service_tariff t
                join client c on c.id = t.client_id
                join contract ct on ct.id = t.contract_id
                where t.complex_service_id = ? order by c.name, ct.name, t.active desc, t.id
                """, (rs, row) -> {
                    BigDecimal coefficient = rs.getBigDecimal("coefficient");
                    return new ComplexServiceTariff(rs.getObject("id", UUID.class),
                            rs.getObject("client_id", UUID.class), rs.getString("client_name"),
                            rs.getObject("contract_id", UUID.class), rs.getString("contract_name"),
                            coefficient, rs.getBoolean("active"),
                            base.priceWithoutVat().multiply(coefficient).setScale(2, RoundingMode.HALF_UP),
                            base.priceWithVat().multiply(coefficient).setScale(2, RoundingMode.HALF_UP));
                }, id);
        return new ComplexServiceDetails(base, tariffs);
    }

    @Transactional
    public ComplexServiceDetails create(ComplexServiceRequest request) {
        validatePrices(request.priceWithoutVat(), request.priceWithVat());
        UUID id = UUID.randomUUID();
        jdbc.update("insert into complex_service_catalog(id, name, price_without_vat, price_with_vat) values (?, ?, ?, ?)",
                id, request.name().trim(), request.priceWithoutVat(), request.priceWithVat());
        return findById(id);
    }

    @Transactional
    public ComplexServiceDetails update(UUID id, ComplexServiceRequest request) {
        validatePrices(request.priceWithoutVat(), request.priceWithVat());
        int changed = jdbc.update("update complex_service_catalog set name = ?, price_without_vat = ?, price_with_vat = ? where id = ?",
                request.name().trim(), request.priceWithoutVat(), request.priceWithVat(), id);
        if (changed == 0) throw new ApiException(HttpStatus.NOT_FOUND,
                "COMPLEX_SERVICE_NOT_FOUND", "Комплексная услуга не найдена");
        return findById(id);
    }

    @Transactional
    public void delete(UUID id) {
        int deleted = jdbc.update("delete from complex_service_catalog where id = ?", id);
        if (deleted == 0) throw new ApiException(HttpStatus.NOT_FOUND,
                "COMPLEX_SERVICE_NOT_FOUND", "Комплексная услуга не найдена");
    }

    @Transactional
    public ComplexServiceDetails saveTariff(UUID serviceId, ComplexServiceTariffRequest request) {
        lockService(serviceId);
        validateContract(request);
        // Creation must never overwrite an existing active tariff, even for an inactive new row.
        requireNoActiveTariff(serviceId, request.clientId(), request.contractId(), null);
        jdbc.update("""
                insert into complex_service_tariff(id, complex_service_id, client_id, contract_id, coefficient, active)
                values (?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), serviceId, request.clientId(), request.contractId(), request.coefficient(),
                request.active() == null || request.active());
        return findById(serviceId);
    }

    @Transactional
    public ComplexServiceDetails updateTariff(UUID serviceId, UUID tariffId, ComplexServiceTariffRequest request) {
        lockService(serviceId);
        var rows = jdbc.query("select client_id, contract_id, active from complex_service_tariff where id = ? and complex_service_id = ?",
                (rs, row) -> new TariffKey(rs.getObject("client_id", UUID.class), rs.getObject("contract_id", UUID.class), rs.getBoolean("active")),
                tariffId, serviceId);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "TARIFF_NOT_FOUND", "Тариф не найден");
        TariffKey current = rows.getFirst();
        if (!current.clientId().equals(request.clientId()) || !current.contractId().equals(request.contractId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TARIFF_KEYS_IMMUTABLE", "Клиента и договор существующего тарифа изменить нельзя");
        }
        boolean active = request.active() == null ? current.active() : request.active();
        if (active) requireNoActiveTariff(serviceId, current.clientId(), current.contractId(), tariffId);
        jdbc.update("update complex_service_tariff set coefficient = ?, active = ? where id = ? and complex_service_id = ?",
                request.coefficient(), active, tariffId, serviceId);
        return findById(serviceId);
    }

    @Transactional
    public void deleteTariff(UUID serviceId, UUID tariffId) {
        lockService(serviceId);
        if (Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from service_execution where tariff_id = ?) or exists(select 1 from comprehensive_service_order_tariff where tariff_id = ?)", Boolean.class, tariffId, tariffId))) {
            throw new ApiException(HttpStatus.CONFLICT, "TARIFF_IN_USE", "Тариф использован в расчётах. Вместо удаления снимите признак «Активный» в форме редактирования");
        }
        int deleted = jdbc.update("delete from complex_service_tariff where complex_service_id = ? and id = ?", serviceId, tariffId);
        if (deleted == 0) throw new ApiException(HttpStatus.NOT_FOUND, "TARIFF_NOT_FOUND", "Тариф не найден");
    }

    @Transactional(readOnly = true)
    public ComplexServiceTariff findTariff(UUID tariffId) {
        var services = jdbc.query("select complex_service_id from complex_service_tariff where id = ?",
                (rs, row) -> rs.getObject(1, UUID.class), tariffId);
        if (services.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "TARIFF_NOT_FOUND", "Тариф не найден");
        return findById(services.getFirst()).tariffs().stream().filter(t -> t.id().equals(tariffId)).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TARIFF_NOT_FOUND", "Тариф не найден"));
    }

    private void lockService(UUID serviceId) {
        var ids = jdbc.query("select id from complex_service_catalog where id = ? for update", (rs, row) -> rs.getObject("id", UUID.class), serviceId);
        if (ids.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "COMPLEX_SERVICE_NOT_FOUND", "Комплексная услуга не найдена");
    }

    private void validateContract(ComplexServiceTariffRequest request) {
        Boolean matches = jdbc.queryForObject("select exists(select 1 from contract where id = ? and client_id = ?)",
                Boolean.class, request.contractId(), request.clientId());
        if (!Boolean.TRUE.equals(matches)) throw new ApiException(HttpStatus.BAD_REQUEST,
                "CONTRACT_CLIENT_MISMATCH", "Договор не принадлежит выбранному клиенту");
    }

    private void requireNoActiveTariff(UUID serviceId, UUID clientId, UUID contractId, UUID exceptId) {
        Boolean exists = jdbc.queryForObject("""
                select exists(select 1 from complex_service_tariff
                where complex_service_id = ? and client_id = ? and contract_id = ? and active
                  and (?::uuid is null or id <> ?))
                """, Boolean.class, serviceId, clientId, contractId, exceptId, exceptId);
        if (Boolean.TRUE.equals(exists)) throw new ApiException(HttpStatus.CONFLICT, "ACTIVE_TARIFF_EXISTS",
                "Для этой услуги, клиента и договора уже есть активный тариф. Сначала снимите признак «Активный» у существующего тарифа");
    }

    private record TariffKey(UUID clientId, UUID contractId, boolean active) {}

    private static void validatePrices(BigDecimal withoutVat, BigDecimal withVat) {
        if (withVat.compareTo(withoutVat) < 0) throw new ApiException(HttpStatus.BAD_REQUEST,
                "INVALID_SERVICE_PRICE", "Цена с НДС не может быть ниже цены без НДС");
    }
}
