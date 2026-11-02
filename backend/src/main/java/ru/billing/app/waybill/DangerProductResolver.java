package ru.billing.app.waybill;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import ru.billing.app.error.ApiException;

@Component
public class DangerProductResolver {
    private final JdbcTemplate jdbc;
    public DangerProductResolver(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public UUID resolve(WaybillProductRequest product) {
        if (product.hazardClassId() != null) throw error("WAYBILL_DANGER_PRODUCT_REQUIRED", "Класс опасности накладной задаётся через опасный груз: dangerProductId или danger_product");
        Integer identifier = null;
        if (product.dangerProduct() != null) {
            try { identifier = Integer.valueOf(product.dangerProduct()); }
            catch (NumberFormatException e) { throw error("INVALID_DANGER_PRODUCT", "Идентификатор опасного груза должен быть целым числом"); }
        }
        if (product.dangerProductId() != null) {
            var identifiers = jdbc.query("select identifier from danger_product where id = ?", (rs, row) -> rs.getInt(1), product.dangerProductId());
            if (identifiers.isEmpty()) throw error("DANGER_PRODUCT_NOT_FOUND", "Опасный груз не найден");
            if (identifier != null && !identifier.equals(identifiers.getFirst())) throw error("CONFLICTING_DANGER_PRODUCT", "UUID и идентификатор опасного груза не совпадают");
            return product.dangerProductId();
        }
        var ids = jdbc.query("select id from danger_product where identifier = ?", (rs, row) -> rs.getObject(1, UUID.class), identifier == null ? -1 : identifier);
        if (ids.isEmpty()) throw error("DANGER_PRODUCT_NOT_FOUND", "Опасный груз не найден");
        return ids.getFirst();
    }
    private ApiException error(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
