package ru.billing.app.serviceorder;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotEmpty;
import java.util.HashSet;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.*;

@Service
public class ReturnReceivingService {
    private final JdbcTemplate jdbc;
    private final ReceivingOrderService receiving;

    public ReturnReceivingService(JdbcTemplate jdbc, ReceivingOrderService receiving) {
        this.jdbc = jdbc;
        this.receiving = receiving;
    }

    public record ReturnRequest(@NotEmpty List<@NotNull UUID> containerIds) {}

    @Transactional
    public CreatedOrderResponse create(UUID shippingId, ReturnRequest request) {
        var sources = jdbc.query("""
                select id, service_order_id, client_id, contract_id, terminal_area_catalog_id
                  from shipping_order where id = ? for update
                """, (rs, row) -> new Source(rs.getObject("service_order_id", UUID.class),
                        rs.getObject("client_id", UUID.class), rs.getObject("contract_id", UUID.class),
                        rs.getObject("terminal_area_catalog_id", UUID.class)), shippingId);
        if (sources.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "SHIPPING_ORDER_NOT_FOUND", "Заявка на вывоз не найдена");
        Source source = sources.getFirst();
        if (source.serviceId() == null) throw new ApiException(HttpStatus.BAD_REQUEST, "SERVICE_SHIPPING_REQUIRED", "Возврат доступен только для вывоза в заявке на услугу");
        var existing = jdbc.query("select id, code, status from receiving_order where source_shipping_order_id = ?",
                (rs, row) -> new CreatedOrderResponse(rs.getObject("id", UUID.class), rs.getInt("code"), rs.getString("status")), shippingId);
        if (!existing.isEmpty()) return existing.getFirst();
        var ids = new HashSet<UUID>();
        for (UUID containerId : request.containerIds()) {
            if (!ids.add(containerId)) throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_CONTAINER", "КТК указан повторно");
        Integer linked = jdbc.queryForObject("select count(*) from shipping_order_source_container where shipping_order_id = ? and container_id = ?",
                Integer.class, shippingId, containerId);
        if (linked == null || linked == 0) throw new ApiException(HttpStatus.BAD_REQUEST, "CONTAINER_NOT_IN_SHIPPING", "КТК не относится к этому вывозу");
        }
        CreatedOrderResponse created = receiving.create(new CreateOrderRequest(source.clientId(), source.contractId(), source.areaId(),
                TransportType.VEHICLE, request.containerIds().stream().map(id -> new OrderContainerRequest(id, true, null)).toList(), List.of(), List.of(), FillingType.ALL, List.of(), List.of()));
        jdbc.update("""
                update receiving_order set service_order_id = ?, service_role = 'RETURN_RECEIVING',
                    source_shipping_order_id = ? where id = ?
                """, source.serviceId(), shippingId, created.id());
        return created;
    }

    public record BulkReturnRequest(@NotEmpty List<@NotNull UUID> shippingOrderIds) {}

    @Transactional
    public List<CreatedOrderResponse> createBulk(UUID serviceId, BulkReturnRequest request) {
        var ids = request.shippingOrderIds().stream().distinct().sorted().toList();
        // Stable lock order protects overlapping selections; the entire selection commits together.
        for (UUID id : ids) {
            var rows = jdbc.query("select id from shipping_order where id = ? and service_order_id = ? and transport_type = 'VEHICLE' for update",
                    (rs, row) -> rs.getObject("id", UUID.class), id, serviceId);
            if (rows.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SERVICE_SHIPPING", "Вывоз не относится к этой услуге или не является автомобильным");
        }
        var result = new java.util.ArrayList<CreatedOrderResponse>();
        for (UUID id : ids) {
            var containers = jdbc.query("select container_id from shipping_order_source_container where shipping_order_id = ? order by container_id",
                    (rs, row) -> rs.getObject("container_id", UUID.class), id);
            if (containers.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "RETURN_CONTAINERS_REQUIRED", "В заявке на вывоз отсутствуют КТК");
            result.add(create(id, new ReturnRequest(containers)));
        }
        return result;
    }

    private record Source(UUID serviceId, UUID clientId, UUID contractId, UUID areaId) {}
}

@RestController
@RequestMapping("/api/shipping-orders/{shippingId}/returns")
class ReturnReceivingController {
    private final ReturnReceivingService service;
    ReturnReceivingController(ReturnReceivingService service) { this.service = service; }

    @PostMapping
    public CreatedOrderResponse create(@PathVariable UUID shippingId, @Valid @RequestBody ReturnReceivingService.ReturnRequest request) {
        return service.create(shippingId, request);
    }
}

@RestController
@RequestMapping("/api/service-orders/{serviceId}/returns")
class BulkReturnController {
    private final ReturnReceivingService service;
    BulkReturnController(ReturnReceivingService service) { this.service = service; }
    @PostMapping
    public List<CreatedOrderResponse> create(@PathVariable UUID serviceId, @Valid @RequestBody ReturnReceivingService.BulkReturnRequest request) {
        return service.createBulk(serviceId, request);
    }
}
