package ru.billing.app.system;

import java.time.Clock;
import java.time.Instant;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SystemStatusService {

    private final JdbcTemplate jdbcTemplate;
    private final Clock clock;

    public SystemStatusService(JdbcTemplate jdbcTemplate, Clock clock) {
        this.jdbcTemplate = jdbcTemplate;
        this.clock = clock;
    }

    public SystemStatus getStatus() {
        Integer databaseCheck = jdbcTemplate.queryForObject("select 1", Integer.class);
        String databaseStatus = Integer.valueOf(1).equals(databaseCheck) ? "up" : "down";

        return new SystemStatus("billing-backend", "up", databaseStatus, Instant.now(clock));
    }
}
