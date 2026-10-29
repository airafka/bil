package ru.billing.app.order;

import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.error.ApiException;

@org.springframework.stereotype.Service
public class OrderStatusService {
    private final JdbcTemplate jdbc;
    private final ru.billing.app.billing.BillingService billing;
    public OrderStatusService(JdbcTemplate jdbc, ru.billing.app.billing.BillingService billing) { this.jdbc = jdbc; this.billing = billing; }

    public enum Status { DRAFT, CONFIRMED, COMPLETED }
    public record ChangeStatusRequest(@NotNull Status expectedStatus, @NotNull Status status) {}

    @Transactional
    public CreatedOrderResponse change(String resource, UUID id,
            ChangeStatusRequest request) {
        String table = switch (resource) {
            case "receiving-orders" -> "receiving_order";
            case "shipping-orders" -> "shipping_order";
            case "service-orders" -> "service_order";
            default -> throw new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Заявка не найдена");
        };
        var rows = jdbc.query("select code, status from " + table + " where id = ? for update",
                (rs, row) -> new CreatedOrderResponse(id, rs.getInt("code"), rs.getString("status")), id);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Заявка не найдена");
        var current = rows.getFirst();
        if (!current.status().equals(request.expectedStatus().name())) {
            throw new ApiException(HttpStatus.CONFLICT, "STATUS_CHANGED", "Статус уже изменён. Обновите страницу перед следующим действием.");
        }
        boolean allowed = request.expectedStatus() == Status.DRAFT && request.status() == Status.CONFIRMED
                || request.expectedStatus() == Status.CONFIRMED && request.status() == Status.COMPLETED;
        if (!allowed) throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATUS_TRANSITION",
                "Допустимы только переходы: Черновик → Подтверждено → Выполнено");
        if ("receiving-orders".equals(resource) && request.status() == Status.COMPLETED) {
            var sourceCompleted = jdbc.query("""
                    select sh.status = 'COMPLETED' from receiving_order r
                    join shipping_order sh on sh.id = r.source_shipping_order_id
                    where r.id = ? and r.service_role = 'RETURN_RECEIVING'
                    """, (rs, row) -> rs.getBoolean(1), id);
            if (!sourceCompleted.isEmpty() && Boolean.FALSE.equals(sourceCompleted.getFirst())) throw new ApiException(HttpStatus.CONFLICT,
                    "SOURCE_SHIPPING_NOT_COMPLETED", "Сначала выполните исходный вывоз");
        }
        if ("service-orders".equals(resource) && request.status() == Status.COMPLETED) {
            Integer unfinishedReceiving = jdbc.queryForObject("select count(*) from receiving_order where service_order_id = ? and status <> 'COMPLETED'", Integer.class, id);
            Integer unfinishedShipping = jdbc.queryForObject("select count(*) from shipping_order where service_order_id = ? and status <> 'COMPLETED'", Integer.class, id);
            if ((unfinishedReceiving != null && unfinishedReceiving > 0) || (unfinishedShipping != null && unfinishedShipping > 0)) {
                throw new ApiException(HttpStatus.CONFLICT, "SERVICE_CHILD_ORDERS_UNFINISHED",
                        "Завершите связанные поставки и вывозы перед выполнением услуги");
            }
            Integer remaining = jdbc.queryForObject("""
                    select count(distinct wc.container_id)
                    from receiving_order r
                    join waybill w on w.receiving_order_id = r.id
                    join waybill_railway_carriage rc on rc.waybill_id = w.id
                    join waybill_container wc on wc.waybill_railway_carriage_id = rc.id
                    where r.service_order_id = ? and not exists (
                        select 1 from shipping_order_source_container link
                        where link.service_order_id = r.service_order_id
                          and link.container_id = wc.container_id
                    )
                    """, Integer.class, id);
            if (remaining != null && remaining > 0) throw new ApiException(HttpStatus.CONFLICT,
                    "SERVICE_CONTAINERS_UNASSIGNED", "Создайте заявки на вывоз для всех КТК перед выполнением услуги");
        }
        if (request.status() == Status.COMPLETED) billing.complete(resource, id);
        jdbc.update("update " + table + " set status = ? where id = ?", request.status().name(), id);
        return new CreatedOrderResponse(id, current.code(), request.status().name());
    }
}
