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
                select t.id, t.client_id, c.code as client_name, t.contract_id,
                       ct.name as contract_name, t.coefficient
                from complex_service_tariff t
                join client c on c.id = t.client_id
                join contract ct on ct.id = t.contract_id
                where t.complex_service_id = ? order by c.code, ct.name
                """, (rs, row) -> {
                    BigDecimal coefficient = rs.getBigDecimal("coefficient");
                    return new ComplexServiceTariff(rs.getObject("id", UUID.class),
                            rs.getObject("client_id", UUID.class), rs.getString("client_name"),
                            rs.getObject("contract_id", UUID.class), rs.getString("contract_name"),
                            coefficient,
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
        if (jdbc.queryForObject("select count(*) from complex_service_catalog where id = ?", Integer.class, serviceId) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "COMPLEX_SERVICE_NOT_FOUND", "Комплексная услуга не найдена");
        }
        Boolean contractMatches = jdbc.queryForObject(
                "select exists(select 1 from contract where id = ? and client_id = ?)",
                Boolean.class, request.contractId(), request.clientId());
        if (!Boolean.TRUE.equals(contractMatches)) throw new ApiException(HttpStatus.BAD_REQUEST,
                "CONTRACT_CLIENT_MISMATCH", "Договор не принадлежит выбранному клиенту");
        jdbc.update("""
                insert into complex_service_tariff(id, complex_service_id, client_id, contract_id, coefficient)
                values (?, ?, ?, ?, ?)
                on conflict (complex_service_id, contract_id) do update set coefficient = excluded.coefficient
                """, UUID.randomUUID(), serviceId, request.clientId(), request.contractId(), request.coefficient());
        return findById(serviceId);
    }

    @Transactional
    public void deleteTariff(UUID serviceId, UUID contractId) {
        int deleted = jdbc.update("delete from complex_service_tariff where complex_service_id = ? and contract_id = ?",
                serviceId, contractId);
        if (deleted == 0) throw new ApiException(HttpStatus.NOT_FOUND,
                "TARIFF_NOT_FOUND", "Тариф для договора не найден");
    }

    private static void validatePrices(BigDecimal withoutVat, BigDecimal withVat) {
        if (withVat.compareTo(withoutVat) < 0) throw new ApiException(HttpStatus.BAD_REQUEST,
                "INVALID_SERVICE_PRICE", "Цена с НДС не может быть ниже цены без НДС");
    }
}
