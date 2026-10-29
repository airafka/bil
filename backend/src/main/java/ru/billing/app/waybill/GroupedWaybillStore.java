package ru.billing.app.waybill;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class GroupedWaybillStore {

    private static final Map<String, String> SORT_COLUMNS = Map.of(
            "departureStation", "departure_station",
            "destinationStation", "destination_station",
            "payer", "payer",
            "railwayCarriageCount", "railway_carriage_count",
            "containerCount", "container_count",
            "waybillCount", "waybill_count"
    );

    private final JdbcTemplate jdbcTemplate;

    public GroupedWaybillStore(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public GroupedWaybillPage findPage(GroupedWaybillRequest request) {
        int page = request.pageInfo() == null || request.pageInfo().page() == null
                ? 0 : Math.max(0, request.pageInfo().page());
        int size = request.pageInfo() == null || request.pageInfo().size() == null
                ? 20 : Math.max(1, Math.min(100, request.pageInfo().size()));
        boolean availableOnly = Boolean.TRUE.equals(request.availableForReceivingOrderOnly());
        SqlFilter filter = filter(request.filter(), availableOnly);
        String availableCorrelated = availableOnly ? " and cw.receiving_order_id is null" : "";

        long total = jdbcTemplate.queryForObject(
                "select count(*) from (select 1 from waybill w " + filter.sql()
                        + " group by w.departure_station, w.destination_station, w.payer) grouped",
                Long.class,
                filter.parameters().toArray()
        );
        if (total == 0) return new GroupedWaybillPage(List.of(), 0, 0, page, size);

        String sortColumn = request.sortingColumn() == null
                ? "departure_station"
                : SORT_COLUMNS.getOrDefault(request.sortingColumn(), "departure_station");
        String sortDirection = "DESC".equalsIgnoreCase(request.sortingDirection()) ? "desc" : "asc";
        List<Object> pageParameters = new ArrayList<>(filter.parameters());
        pageParameters.add(size);
        pageParameters.add(page * size);

        List<GroupCandidate> candidates = jdbcTemplate.query(
                """
                select w.departure_station, w.destination_station, w.payer,
                       count(*) as waybill_count,
                       (select count(*)
                          from waybill_railway_carriage wrc
                          join waybill cw on cw.id = wrc.waybill_id
                         where cw.departure_station = w.departure_station
                           and cw.destination_station = w.destination_station
                           and cw.payer = w.payer
                """ + availableCorrelated + """
                       ) as railway_carriage_count,
                       (select count(*)
                          from waybill_container wc
                          join waybill_railway_carriage wrc on wrc.id = wc.waybill_railway_carriage_id
                          join waybill cw on cw.id = wrc.waybill_id
                         where cw.departure_station = w.departure_station
                           and cw.destination_station = w.destination_station
                           and cw.payer = w.payer
                """ + availableCorrelated + """
                       ) as container_count
                  from waybill w
                """ + filter.sql() + """
                 group by w.departure_station, w.destination_station, w.payer
                 order by 
                """ + sortColumn + " " + sortDirection
                        + ", departure_station asc, destination_station asc, payer asc limit ? offset ?",
                (resultSet, rowNumber) -> new GroupCandidate(
                        new GroupKey(
                                resultSet.getInt("departure_station"),
                                resultSet.getInt("destination_station"),
                                resultSet.getString("payer")
                        ),
                        resultSet.getLong("railway_carriage_count"),
                        resultSet.getLong("container_count"),
                        resultSet.getLong("waybill_count")
                ),
                pageParameters.toArray()
        );

        int totalPages = (int) Math.ceil((double) total / size);
        if (candidates.isEmpty()) {
            return new GroupedWaybillPage(List.of(), total, totalPages, page, size);
        }

        BatchFilter batchFilter = batchFilter(candidates, availableOnly);
        ProductIndex products = loadProducts(batchFilter);
        Map<GroupKey, List<WaybillLink>> waybills = loadWaybills(batchFilter, products.byWaybill());

        List<GroupedWaybillRow> content = candidates.stream().map(candidate -> {
            GroupKey key = candidate.key();
            return new GroupedWaybillRow(
                    key.departureStation() + "|" + key.destinationStation() + "|" + key.payer(),
                    key.departureStation(),
                    key.destinationStation(),
                    key.payer(),
                    products.byGroup().getOrDefault(key, List.of()),
                    candidate.railwayCarriageCount(),
                    candidate.containerCount(),
                    candidate.waybillCount(),
                    waybills.getOrDefault(key, List.of())
            );
        }).toList();

        return new GroupedWaybillPage(content, total, totalPages, page, size);
    }

    private Map<GroupKey, List<WaybillLink>> loadWaybills(
            BatchFilter batchFilter,
            Map<UUID, List<WaybillProductSummary>> productsByWaybill
    ) {
        Map<GroupKey, List<WaybillLink>> result = new LinkedHashMap<>();
        Map<UUID, List<WaybillContainerSummary>> containersByWaybill = loadContainers(batchFilter);
        jdbcTemplate.query(
                "select w.id, w.number, w.departure_station, w.destination_station, w.payer, "
                        + "(select count(*) from waybill_railway_carriage wrc where wrc.waybill_id = w.id) "
                        + "as railway_carriage_count, "
                        + "(select count(*) from waybill_container wc "
                        + "join waybill_railway_carriage wrc on wrc.id = wc.waybill_railway_carriage_id "
                        + "where wrc.waybill_id = w.id) as container_count "
                        + "from waybill w where "
                        + batchFilter.sql() + " order by w.number, w.id",
                resultSet -> {
                    GroupKey key = new GroupKey(
                            resultSet.getInt("departure_station"),
                            resultSet.getInt("destination_station"),
                            resultSet.getString("payer")
                    );
                    result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(new WaybillLink(
                            resultSet.getObject("id", UUID.class),
                            resultSet.getString("number"),
                            resultSet.getLong("railway_carriage_count"),
                            resultSet.getLong("container_count"),
                            productsByWaybill.getOrDefault(resultSet.getObject("id", UUID.class), List.of()),
                            containersByWaybill.getOrDefault(resultSet.getObject("id", UUID.class), List.of())
                    ));
                },
                batchFilter.parameters().toArray()
        );
        return result;
    }

    private ProductIndex loadProducts(BatchFilter batchFilter) {
        Map<GroupKey, List<WaybillProductSummary>> byGroup = new LinkedHashMap<>();
        Map<UUID, List<WaybillProductSummary>> byWaybill = new LinkedHashMap<>();
        jdbcTemplate.query(
                """
                select p.id, p.etsng_code_id, e.code as etsng_display, (wc.gross_weight - c.tare_weight) as weight, w.id as waybill_id,
                       w.departure_station, w.destination_station, w.payer
                  from waybill_product p
                  join waybill w on w.id = p.waybill_id
                  join waybill_container wc on wc.id = p.waybill_container_id
                  join container c on c.id = wc.container_id
                  join etsng_code e on e.id = p.etsng_code_id
                 where 
                """ + batchFilter.sql() + " order by p.id",
                resultSet -> {
                    GroupKey key = new GroupKey(
                            resultSet.getInt("departure_station"),
                            resultSet.getInt("destination_station"),
                            resultSet.getString("payer")
                    );
                    String[] display = splitEtsngDisplay(resultSet.getString("etsng_display"));
                    WaybillProductSummary product = new WaybillProductSummary(
                            resultSet.getObject("id", UUID.class),
                            resultSet.getObject("etsng_code_id", UUID.class),
                            display[0],
                            display[1],
                            resultSet.getBigDecimal("weight")
                    );
                    byGroup.computeIfAbsent(key, ignored -> new ArrayList<>()).add(product);
                    byWaybill.computeIfAbsent(
                            resultSet.getObject("waybill_id", UUID.class),
                            ignored -> new ArrayList<>()
                    ).add(product);
                },
                batchFilter.parameters().toArray()
        );
        return new ProductIndex(byGroup, byWaybill);
    }

    private Map<UUID, List<WaybillContainerSummary>> loadContainers(BatchFilter filter) {
        Map<UUID, List<WaybillContainerSummary>> result = new LinkedHashMap<>();
        jdbcTemplate.query("""
                select w.id as waybill_id, wc.container_id, c.code as container_number,
                       wc.gross_weight, c.tare_weight as tare_weight, (wc.gross_weight - c.tare_weight) as net_weight, p.etsng_code_id, e.code as etsng_name
                from waybill_container wc
                join container c on c.id = wc.container_id
                join waybill_railway_carriage rc on rc.id = wc.waybill_railway_carriage_id
                join waybill w on w.id = rc.waybill_id
                left join waybill_product p on p.waybill_container_id = wc.id
                left join etsng_code e on e.id = p.etsng_code_id
                where
                """ + filter.sql() + " order by w.number, c.code",
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> result.computeIfAbsent(rs.getObject("waybill_id", UUID.class), key -> new ArrayList<>())
                        .add(new WaybillContainerSummary(rs.getObject("container_id", UUID.class), rs.getString("container_number"),
                                rs.getBigDecimal("gross_weight"), rs.getBigDecimal("tare_weight"), rs.getBigDecimal("net_weight"),
                                rs.getObject("etsng_code_id", UUID.class), rs.getString("etsng_name"))), filter.parameters().toArray());
        return result;
    }

    private SqlFilter filter(WaybillFilter filter, boolean availableOnly) {
        StringBuilder sql = new StringBuilder("where 1 = 1");
        List<Object> parameters = new ArrayList<>();
        if (availableOnly) {
            sql.append(" and w.receiving_order_id is null");
        }
        if (filter != null && filter.departureStation() != null) {
            sql.append(" and w.departure_station = ?");
            parameters.add(filter.departureStation());
        }
        if (filter != null && filter.destinationStation() != null) {
            sql.append(" and w.destination_station = ?");
            parameters.add(filter.destinationStation());
        }
        if (filter != null && filter.payer() != null && !filter.payer().trim().isEmpty()) {
            sql.append(" and w.payer = ?");
            parameters.add(filter.payer().trim());
        }
        return new SqlFilter(sql.toString(), parameters);
    }

    private BatchFilter batchFilter(List<GroupCandidate> candidates, boolean availableOnly) {
        List<String> clauses = new ArrayList<>();
        List<Object> parameters = new ArrayList<>();
        candidates.forEach(candidate -> {
            clauses.add("(w.departure_station = ? and w.destination_station = ? and w.payer = ?)");
            parameters.add(candidate.key().departureStation());
            parameters.add(candidate.key().destinationStation());
            parameters.add(candidate.key().payer());
        });
        String grouped = "(" + String.join(" or ", clauses) + ")";
        return new BatchFilter(
                availableOnly ? grouped + " and w.receiving_order_id is null" : grouped,
                parameters
        );
    }

    private String[] splitEtsngDisplay(String display) {
        String[] parts = display.split("\\s+—\\s+", 2);
        return parts.length == 2 ? parts : new String[] { display, display };
    }

    private record SqlFilter(String sql, List<Object> parameters) {
    }

    private record BatchFilter(String sql, List<Object> parameters) {
    }

    private record ProductIndex(
            Map<GroupKey, List<WaybillProductSummary>> byGroup,
            Map<UUID, List<WaybillProductSummary>> byWaybill
    ) {
    }

    private record GroupKey(int departureStation, int destinationStation, String payer) {
    }

    private record GroupCandidate(
            GroupKey key,
            long railwayCarriageCount,
            long containerCount,
            long waybillCount
    ) {
    }
}
