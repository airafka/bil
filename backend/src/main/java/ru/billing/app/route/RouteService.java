package ru.billing.app.route;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.TransportType;

@Service
public class RouteService {
    private final JdbcTemplate jdbc;

    public RouteService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static String orderTable(RouteType type) {
        return type == RouteType.RECEIVING ? "receiving_order" : "shipping_order";
    }

    private static String text(String value) { return value == null ? null : value.trim(); }

    @Transactional
    public RouteDetails create(CreateRouteRequest request) {
        if (request.routeType() == null || request.transportType() == null || request.terminalAreaId() == null
                || request.departureAt() == null || request.orderIds() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROUTE_REQUIRED_FIELDS", "Заполните основные поля рейса");
        }
        if (request.comment() != null && request.comment().length() > 200) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROUTE_COMMENT_TOO_LONG", "Комментарий не должен превышать 200 символов");
        }
        String carrier = text(request.carrier());
        String driver = text(request.driverName());
        String vehicle = text(request.vehicleNumber());
        if (request.transportType() == TransportType.VEHICLE
                && (carrier == null || carrier.isBlank() || driver == null || driver.isBlank()
                || vehicle == null || vehicle.isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROUTE_VEHICLE_DETAILS_REQUIRED",
                    "Для авторейса укажите перевозчика, водителя и номер машины");
        }
        List<String> areas = jdbc.query("select code from terminal_area_catalog where id = ?",
                (rs, row) -> rs.getString("code"), request.terminalAreaId());
        if (areas.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "ROUTE_AREA_NOT_FOUND", "Площадка не найдена");
        if (request.transportType() == TransportType.RAILWAY && !areas.getFirst().equals("CONTAINER")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROUTE_AREA_TRANSPORT_MISMATCH", "ЖД-рейс возможен только для контейнерной площадки");
        }
        Set<UUID> unique = validateOrders(request.routeType(), request.transportType(), request.terminalAreaId(), request.orderIds());
        String table = orderTable(request.routeType());
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into route(id, route_type, departure_at, terminal_area_catalog_id, transport_type,
                                  carrier, driver_name, vehicle_number, comment)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, request.routeType().name(), request.departureAt(), request.terminalAreaId(),
                request.transportType().name(), carrier, driver, vehicle, text(request.comment()));
        for (UUID orderId : unique) jdbc.update("update " + table + " set route_id = ? where id = ?", id, orderId);
        return findById(id);
    }

    @Transactional
    public RouteDetails assign(UUID routeId, List<UUID> orderIds) {
        List<RouteSummary> rows = jdbc.query(summarySql() + " where r.id = ? for update of r",
                (rs, row) -> summary(rs), routeId);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "ROUTE_NOT_FOUND", "Рейс не найден");
        RouteSummary route = rows.getFirst();
        if (!"DRAFT".equals(route.status())) throw new ApiException(HttpStatus.CONFLICT, "ROUTE_NOT_DRAFT",
                "Добавлять заявки можно только в черновой рейс");
        if (orderIds == null || orderIds.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST,
                "ROUTE_ORDERS_REQUIRED", "Выберите хотя бы одну заявку");
        Set<UUID> unique = validateOrders(route.routeType(), route.transportType(), route.terminalAreaId(), orderIds);
        String table = orderTable(route.routeType());
        for (UUID orderId : unique) jdbc.update("update " + table + " set route_id = ? where id = ?", routeId, orderId);
        return findById(routeId);
    }

    private Set<UUID> validateOrders(RouteType type, TransportType transportType, UUID areaId, List<UUID> orderIds) {
        Set<UUID> unique = new HashSet<>(orderIds);
        if (unique.contains(null) || unique.size() != orderIds.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROUTE_DUPLICATE_ORDERS", "Заявки в рейсе не должны повторяться");
        }
        String table = orderTable(type);
        for (UUID orderId : unique.stream().sorted(Comparator.naturalOrder()).toList()) {
            List<OrderCandidate> matches = jdbc.query("select status, terminal_area_catalog_id, transport_type, route_id from "
                            + table + " where id = ? for update", (rs, row) -> new OrderCandidate(rs.getString("status"),
                    rs.getObject("terminal_area_catalog_id", UUID.class), rs.getString("transport_type"),
                    rs.getObject("route_id", UUID.class)), orderId);
            if (matches.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "ROUTE_ORDER_NOT_FOUND", "Одна из заявок не найдена");
            OrderCandidate order = matches.getFirst();
            if (!"DRAFT".equals(order.status()) || order.routeId() != null
                    || !areaId.equals(order.areaId()) || !transportType.name().equals(order.transportType())) {
                throw new ApiException(HttpStatus.CONFLICT, "ROUTE_ORDER_UNAVAILABLE",
                        "В рейс можно добавить только свободные черновики того же транспорта и площадки");
            }
        }
        return unique;
    }

    @Transactional(readOnly = true)
    public List<RouteSummary> findAll() {
        return jdbc.query(summarySql() + " order by r.code desc", (rs, row) -> summary(rs));
    }

    @Transactional(readOnly = true)
    public RouteDetails findById(UUID id) {
        List<RouteSummary> rows = jdbc.query(summarySql() + " where r.id = ?", (rs, row) -> summary(rs), id);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "ROUTE_NOT_FOUND", "Рейс не найден");
        RouteSummary route = rows.getFirst();
        String table = orderTable(route.routeType());
        List<RouteOrderOption> orders = jdbc.query("select o.id, o.code, c.code as client_name, o.status from "
                + table + " o join client c on c.id = o.client_id where o.route_id = ? order by o.code",
                (rs, row) -> new RouteOrderOption(rs.getObject("id", UUID.class), rs.getInt("code"),
                        rs.getString("client_name"), rs.getString("status")), id);
        return new RouteDetails(route, orders);
    }

    @Transactional(readOnly = true)
    public List<RouteOrderOption> available(RouteType routeType, TransportType transportType, UUID terminalAreaId) {
        if (routeType == null || transportType == null || terminalAreaId == null) return List.of();
        String table = orderTable(routeType);
        return jdbc.query("select o.id, o.code, c.code as client_name, o.status from " + table
                        + " o join client c on c.id = o.client_id where o.route_id is null and o.status = 'DRAFT'"
                        + " and o.transport_type = ? and o.terminal_area_catalog_id = ? order by o.code desc",
                (rs, row) -> new RouteOrderOption(rs.getObject("id", UUID.class), rs.getInt("code"),
                        rs.getString("client_name"), rs.getString("status")), transportType.name(), terminalAreaId);
    }

    private static String summarySql() {
        return """
                select r.id, r.code, r.route_type, r.departure_at, r.terminal_area_catalog_id,
                       a.name as area_name, r.transport_type, r.carrier, r.driver_name, r.vehicle_number,
                       r.comment, r.status,
                       (select count(*) from receiving_order o where o.route_id = r.id)
                       + (select count(*) from shipping_order o where o.route_id = r.id) as order_count
                from route r join terminal_area_catalog a on a.id = r.terminal_area_catalog_id
                """;
    }

    private static RouteSummary summary(ResultSet rs) throws SQLException {
        return new RouteSummary(rs.getObject("id", UUID.class), rs.getInt("code"),
                RouteType.valueOf(rs.getString("route_type")), rs.getObject("departure_at", OffsetDateTime.class),
                rs.getObject("terminal_area_catalog_id", UUID.class), rs.getString("area_name"),
                TransportType.valueOf(rs.getString("transport_type")), rs.getString("carrier"),
                rs.getString("driver_name"), rs.getString("vehicle_number"), rs.getString("comment"),
                rs.getString("status"), rs.getInt("order_count"));
    }

    private record OrderCandidate(String status, UUID areaId, String transportType, UUID routeId) {}
}
