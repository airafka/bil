package ru.billing.app.waybill;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import ru.billing.app.error.ApiException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class WaybillStoreTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UUID cargo = UUID.randomUUID();
    private CreateWaybillRequest request(UUID cargoId, String... weights) {
        when(jdbc.queryForObject(startsWith("select tare_weight"), eq(BigDecimal.class), any(UUID.class)))
                .thenReturn(new BigDecimal("3200"));
        return new CreateWaybillRequest(null, 1, 2, "P", cargoId,
                List.of(new WaybillRailwayCarriageRequest(UUID.randomUUID(),
                        java.util.Arrays.stream(weights).map(weight -> new WaybillContainerRequest(UUID.randomUUID(), new BigDecimal(weight), null)).toList())));
    }
    @Test void storesOneProductForLoadedAndEmptyContainers() {
        new WaybillStore(jdbc).create(request(cargo, "5000.125", "6000", "3200"));
        verify(jdbc, times(1)).update(startsWith("insert into waybill_product"), any(UUID.class), any(UUID.class), eq(cargo), isNull());
        verify(jdbc, times(3)).update(startsWith("insert into waybill_container"), any(UUID.class), any(UUID.class), any(UUID.class), any(BigDecimal.class), isNull(), isNull(), isNull());
    }
    @Test void acceptsEmptyWaybillWithoutProduct() {
        new WaybillStore(jdbc).create(request(null, "3200"));
        verify(jdbc, never()).update(startsWith("insert into waybill_product"), any(UUID.class), any(UUID.class), any(UUID.class), any());
    }
    @Test void rejectsMissingCargoAndCargoOnEntirelyEmptyComposition() {
        assertThatThrownBy(() -> new WaybillStore(jdbc).create(request(null, "5000")))
                .isInstanceOf(ApiException.class).extracting(e -> ((ApiException)e).getCode()).isEqualTo("ETSNG_CODE_REQUIRED");
        assertThatThrownBy(() -> new WaybillStore(jdbc).create(request(cargo, "3200")))
                .isInstanceOf(ApiException.class).extracting(e -> ((ApiException)e).getCode()).isEqualTo("CARGO_FOR_EMPTY_CONTAINER");
    }
}
