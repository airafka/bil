package ru.billing.app.reference;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import ru.billing.app.error.ApiException;
import ru.billing.app.order.ContainerQuantityRequest;
import ru.billing.app.order.CreateOrderRequest;
import ru.billing.app.order.FillingType;
import ru.billing.app.order.OrderContainerRequest;
import ru.billing.app.order.OrderScenarioPolicy;
import ru.billing.app.order.ShippingOrderRailwayCarriageRequest;
import ru.billing.app.order.TransportType;

@Service
public class ReferenceDataService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;

    private final JdbcTemplate jdbcTemplate;
    private final OrderScenarioPolicy orderScenarioPolicy;

    public ReferenceDataService(JdbcTemplate jdbcTemplate, OrderScenarioPolicy orderScenarioPolicy) {
        this.jdbcTemplate = jdbcTemplate;
        this.orderScenarioPolicy = orderScenarioPolicy;
    }

    public List<ReferenceOption> findSealTypes(String query, Integer limit) { return find("seal_type", query, limit); }
    public List<ReferenceOption> findHazardClasses(String query, Integer limit) { return find("hazard_class", query, limit); }

    public void validateContainerAttributes(UUID ownerClientId, UUID sealTypeId, UUID hazardClassId) {
        if (ownerClientId != null) ensureExists("client", ownerClientId, "OWNER_CLIENT_NOT_FOUND", "Собственник КТК не найден");
        if (sealTypeId != null) ensureExists("seal_type", sealTypeId, "SEAL_TYPE_NOT_FOUND", "Тип ЗПУ не найден");
        if (hazardClassId != null) ensureExists("hazard_class", hazardClassId, "HAZARD_CLASS_NOT_FOUND", "Класс опасности не найден");
    }

    public List<ReferenceOption> findClients(String query, Integer limit) {
        return find("client", query, limit);
    }

    public List<ContainerReferenceOption> findContainers(String query, Integer requestedLimit) {
        int limit = normalizedLimit(requestedLimit);
        String search = query == null ? "" : query.trim();
        return jdbcTemplate.query(
                "select id, code, type, tare_weight, load_capacity from container "
                        + "where lower(code) like lower(?) order by code limit ?",
                (resultSet, rowNumber) -> new ContainerReferenceOption(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("code"),
                        resultSet.getString("type"),
                        resultSet.getBigDecimal("tare_weight"), resultSet.getBigDecimal("load_capacity")
                ),
                "%" + search + "%",
                limit
        );
    }

    @org.springframework.transaction.annotation.Transactional
    public ContainerReferenceOption updateContainerTare(UUID id, java.math.BigDecimal tareWeight) {
        List<UUID> locked = jdbcTemplate.query("select id from container where id = ? for update", (rs, row) -> rs.getObject("id", UUID.class), id);
        if (locked.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "CONTAINER_NOT_FOUND", "КТК не найден");
        Boolean invalid = jdbcTemplate.queryForObject("select exists(select 1 from waybill_container where container_id = ? and gross_weight < ?)", Boolean.class, id, tareWeight);
        if (Boolean.TRUE.equals(invalid)) throw new ApiException(HttpStatus.BAD_REQUEST, "TARE_EXCEEDS_GROSS", "Тара превышает брутто КТК в существующей накладной");
        int updated = jdbcTemplate.update("update container set tare_weight = ? where id = ?", tareWeight, id);
        if (updated == 0) throw new ApiException(HttpStatus.NOT_FOUND, "CONTAINER_NOT_FOUND", "КТК не найден");
        return jdbcTemplate.queryForObject("select id, code, type, tare_weight, load_capacity from container where id = ?",
                (rs, row) -> new ContainerReferenceOption(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("type"), rs.getBigDecimal("tare_weight"), rs.getBigDecimal("load_capacity")), id);
    }

    @org.springframework.transaction.annotation.Transactional
    public ContainerReferenceOption updateContainerAttributes(UUID id, UpdateContainerAttributesRequest request) {
        ContainerReferenceOption current = updateContainerTare(id, request.tareWeight());
        jdbcTemplate.update("update container set load_capacity = ? where id = ?", request.loadCapacity(), id);
        return new ContainerReferenceOption(current.id(), current.name(), current.type(), current.tareWeight(), request.loadCapacity());
    }

    public List<ReferenceOption> findEtsngCodes(String query, Integer limit) {
        return find("etsng_code", query, limit);
    }

    private static final String CARRIAGE_SELECT = """
        select c.id, c.code, c.model_id, m.code as model_name, c.load_capacity, c.next_depot_repair_date,
               c.carriage_type_id, case t.code when 'PLATFORM_40' then 'Платформа 40 - футов'
                   when 'PLATFORM_80' then 'Платформа 80 - футов' else t.name end as type_name
        from railway_carriage c left join railway_carriage_model m on m.id = c.model_id
        left join railway_carriage_type t on t.id = c.carriage_type_id
        """;

    private RailwayCarriageReferenceOption carriage(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new RailwayCarriageReferenceOption(rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getObject("model_id", UUID.class), rs.getString("model_name"), rs.getBigDecimal("load_capacity"),
                rs.getObject("next_depot_repair_date", java.time.LocalDate.class),
                rs.getObject("carriage_type_id", UUID.class), rs.getString("type_name"));
    }

    public List<RailwayCarriageReferenceOption> findRailwayCarriages(String query, Integer limit) {
        return jdbcTemplate.query(CARRIAGE_SELECT + " where lower(c.code) like lower(?) order by c.code limit ?",
                (rs, row) -> carriage(rs), "%" + (query == null ? "" : query.trim()) + "%", normalizedLimit(limit));
    }

    public ru.billing.app.order.PagedResponse<RailwayCarriageReferenceOption> findRailwayCarriagePage(int requestedPage, int requestedSize) {
        int page = Math.max(0, requestedPage), size = Math.max(1, Math.min(100, requestedSize));
        long total = jdbcTemplate.queryForObject("select count(*) from railway_carriage", Long.class);
        var rows = jdbcTemplate.query(CARRIAGE_SELECT + " order by c.code, c.id limit ? offset ?", (rs, row) -> carriage(rs), size, page * size);
        return ru.billing.app.order.PagedResponse.of(rows, page, size, total);
    }

    public List<ReferenceOption> findRailwayCarriageModels(String query, Integer limit) { return find("railway_carriage_model", query, limit); }

    public List<ReferenceOption> findRailwayCarriageKinds() {
        return jdbcTemplate.query("select id, case code when 'PLATFORM_40' then 'Платформа 40 - футов' else 'Платформа 80 - футов' end as name from railway_carriage_type where code in ('PLATFORM_40', 'PLATFORM_80') order by code",
                (rs, row) -> new ReferenceOption(rs.getObject("id", UUID.class), rs.getString("name")));
    }

    @org.springframework.transaction.annotation.Transactional
    public RailwayCarriageReferenceOption updateRailwayCarriage(UUID id, UpdateRailwayCarriageRequest request) {
        ensureExists("railway_carriage", id, "RAILWAY_CARRIAGE_NOT_FOUND", "Вагон не найден");
        if (request.modelId() != null) ensureExists("railway_carriage_model", request.modelId(), "CARRIAGE_MODEL_NOT_FOUND", "Модель вагона не найдена");
        if (request.carriageTypeId() != null && findRailwayCarriageKinds().stream().noneMatch(t -> t.id().equals(request.carriageTypeId()))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CARRIAGE_TYPE", "Выберите платформу 40 или 80 футов");
        }
        int updated = jdbcTemplate.update("update railway_carriage set model_id = ?, load_capacity = ?, next_depot_repair_date = ?, carriage_type_id = ? where id = ?",
                request.modelId(), request.loadCapacity(), request.nextDepotRepairDate(), request.carriageTypeId(), id);
        if (updated != 1) throw new ApiException(HttpStatus.NOT_FOUND, "RAILWAY_CARRIAGE_NOT_FOUND", "Вагон не найден");
        return jdbcTemplate.queryForObject(CARRIAGE_SELECT + " where c.id = ?", (rs, row) -> carriage(rs), id);
    }

    public List<ReferenceOption> findRailwayCarriageTypes(String query, Integer requestedLimit) {
        int limit = normalizedLimit(requestedLimit);
        String search = query == null ? "" : query.trim();
        return jdbcTemplate.query(
                "select id, name from railway_carriage_type "
                        + "where lower(code) like lower(?) or lower(name) like lower(?) order by name limit ?",
                (resultSet, rowNumber) -> new ReferenceOption(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("name")
                ),
                "%" + search + "%",
                "%" + search + "%",
                limit
        );
    }

    public List<TerminalAreaOption> findTerminalAreas() {
        return jdbcTemplate.query(
                "select id, code, name from terminal_area_catalog where code = ? order by name",
                (resultSet, rowNumber) -> new TerminalAreaOption(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("code"),
                        resultSet.getString("name")
                ),
                OrderScenarioPolicy.CONTAINER_AREA_CODE
        );
    }

    public List<TransportTypeOption> findTransportTypes() {
        return List.of(
                new TransportTypeOption(TransportType.VEHICLE, TransportType.VEHICLE.getDisplayName()),
                new TransportTypeOption(TransportType.RAILWAY, TransportType.RAILWAY.getDisplayName())
        );
    }

    public void validateVehicleShippingCapacity(List<OrderContainerRequest> containers) {
        if (containers == null || containers.isEmpty()) return;
        if (containers.size() > 2) throw new ApiException(HttpStatus.BAD_REQUEST,
                "VEHICLE_CONTAINER_CAPACITY", "На одно авто можно поставить не более двух КТК стандарта 20");
        for (OrderContainerRequest container : containers) {
            String type = jdbcTemplate.queryForObject("select type from container where id = ?",
                    String.class, container.containerId());
            if (type == null) throw new ApiException(HttpStatus.BAD_REQUEST,
                    "CONTAINER_TYPE_REQUIRED", "У КТК не указан типоразмер");
            if (!"STANDARD_20".equals(type) && !("STANDARD_40".equals(type) && containers.size() == 1)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VEHICLE_CONTAINER_CAPACITY",
                        "Одно авто вмещает один КТК стандарта 40 или до двух КТК стандарта 20");
            }
        }
    }

    public void validateReferences(CreateOrderRequest request) {
        validateCommonReferences(request);

        if (request.containers() == null) return;
        request.containers().forEach(container -> {
            ensureExists("container", container.containerId(), "CONTAINER_NOT_FOUND", "КТК не найден");
            if (container.cargo() != null) {
                ensureExists(
                        "etsng_code",
                        container.cargo().etsngCodeId(),
                        "ETSNG_CODE_NOT_FOUND",
                        "Код ЕТСНГ не найден"
                );
            }
        });
    }

    public void validateCommonReferences(CreateOrderRequest request) {
        ensureExists("client", request.clientId(), "CLIENT_NOT_FOUND", "Клиент не найден");

        validateContract(request.clientId(), request.contractId());
        String terminalAreaCode = findTerminalAreaCode(request.terminalAreaId());
        FillingType fillingType = request.fillingType() == null ? FillingType.ALL : request.fillingType();
        boolean supportedRailwayComposition = fillingType != FillingType.ALL
                && fillingType != FillingType.VEHICLE_UNNUMBERED
                && request.transportType() == TransportType.RAILWAY;
        boolean supportedVehicleComposition = fillingType == FillingType.VEHICLE_UNNUMBERED
                && request.transportType() == TransportType.VEHICLE;
        if (fillingType != FillingType.ALL
                && (!OrderScenarioPolicy.CONTAINER_AREA_CODE.equals(terminalAreaCode)
                || (!supportedRailwayComposition && !supportedVehicleComposition))) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_FILLING_TYPE_FOR_TRANSPORT",
                    "Выбранный тип заполнения не поддерживается для этого транспорта"
            );
        }
        orderScenarioPolicy.validate(terminalAreaCode, request.transportType());
    }

    public void validateShippingRailwayReferences(CreateOrderRequest request) {
        validateCommonReferences(request);
        for (ShippingOrderRailwayCarriageRequest carriage : values(request.railwayCarriages())) {
            ensureExists(
                    "railway_carriage",
                    carriage.railwayCarriageId(),
                    "RAILWAY_CARRIAGE_NOT_FOUND",
                    "Вагон не найден"
            );
            values(carriage.containers()).forEach(this::validateNumberedContainer);
        }
        values(request.containers()).forEach(this::validateNumberedContainer);
        values(request.railwayCarriageQuantities()).forEach(row -> {
            if (row.typeId() != null) {
                ensureExists(
                        "railway_carriage_type",
                        row.typeId(),
                        "REFERENCE_NOT_FOUND",
                        "Тип вагона не найден"
                );
            }
        });
        for (ContainerQuantityRequest row : values(request.containerQuantities())) {
            values(row.items()).forEach(item -> ensureExists(
                    "etsng_code",
                    item.etsngCodeId(),
                    "ETSNG_CODE_NOT_FOUND",
                    "Код ЕТСНГ не найден"
            ));
        }
    }

    private void validateNumberedContainer(OrderContainerRequest container) {
        ensureExists("container", container.containerId(), "CONTAINER_NOT_FOUND", "КТК не найден");
        if (container.cargo() != null) {
            ensureExists(
                    "etsng_code",
                    container.cargo().etsngCodeId(),
                    "ETSNG_CODE_NOT_FOUND",
                    "Код ЕТСНГ не найден"
            );
        }
    }

    public List<ContractOption> findContracts(UUID clientId) {
        return jdbcTemplate.query("select id, client_id, name from contract where (?::uuid is null or client_id = ?) order by name, id",
                (rs, row) -> new ContractOption(rs.getObject("id", UUID.class), rs.getObject("client_id", UUID.class), rs.getString("name")), clientId, clientId);
    }

    public void validateContract(UUID clientId, UUID contractId) {
        if (contractId == null) throw new ApiException(HttpStatus.BAD_REQUEST, "CONTRACT_REQUIRED", "Выберите договор");
        List<UUID> clients = jdbcTemplate.query("select client_id from contract where id = ?",
                (rs, row) -> rs.getObject("client_id", UUID.class), contractId);
        if (clients.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Договор не найден");
        if (!clients.getFirst().equals(clientId)) throw new ApiException(HttpStatus.BAD_REQUEST, "CONTRACT_CLIENT_MISMATCH", "Договор принадлежит другому клиенту");
    }

    private String findTerminalAreaCode(UUID id) {
        List<String> codes = jdbcTemplate.query(
                "select code from terminal_area_catalog where id = ?",
                (resultSet, rowNumber) -> resultSet.getString("code"),
                id
        );
        if (codes.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "TERMINAL_AREA_NOT_FOUND", "Площадка не найдена: " + id);
        }
        return codes.getFirst();
    }

    private List<ReferenceOption> find(String table, String query, Integer requestedLimit) {
        int limit = normalizedLimit(requestedLimit);
        String search = query == null ? "" : query.trim();
        String sql = "select id, code from " + table
                + " where lower(code) like lower(?) order by code limit ?";

        return jdbcTemplate.query(
                sql,
                (resultSet, rowNumber) -> new ReferenceOption(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("code")
                ),
                "%" + search + "%",
                limit
        );
    }

    private int normalizedLimit(Integer requestedLimit) {
        return requestedLimit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(requestedLimit, MAX_LIMIT));
    }

    private <T> List<T> values(List<T> source) {
        return source == null ? List.of() : source;
    }

    private void ensureExists(String table, UUID id, String errorCode, String message) {
        Boolean exists = jdbcTemplate.queryForObject(
                "select exists(select 1 from " + table + " where id = ?)",
                Boolean.class,
                id
        );
        if (!Boolean.TRUE.equals(exists)) {
            throw new ApiException(HttpStatus.NOT_FOUND, errorCode, message + ": " + id);
        }
    }
}
