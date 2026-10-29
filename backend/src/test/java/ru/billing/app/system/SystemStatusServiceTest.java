package ru.billing.app.system;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class SystemStatusServiceTest {

    @Test
    void reportsBackendAndDatabaseAsAvailable() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject("select 1", Integer.class)).thenReturn(1);
        Instant now = Instant.parse("2026-07-21T12:00:00Z");
        SystemStatusService service = new SystemStatusService(
                jdbcTemplate,
                Clock.fixed(now, ZoneOffset.UTC)
        );

        SystemStatus status = service.getStatus();

        assertThat(status.service()).isEqualTo("billing-backend");
        assertThat(status.status()).isEqualTo("up");
        assertThat(status.database()).isEqualTo("up");
        assertThat(status.timestamp()).isEqualTo(now);
    }
}

