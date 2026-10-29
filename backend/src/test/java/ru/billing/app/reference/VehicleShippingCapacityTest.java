package ru.billing.app.reference;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import ru.billing.app.error.ApiException;
import ru.billing.app.order.OrderContainerRequest;
import ru.billing.app.order.OrderScenarioPolicy;

class VehicleShippingCapacityTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ReferenceDataService references = new ReferenceDataService(jdbc, mock(OrderScenarioPolicy.class));
    private final UUID smallOne = UUID.randomUUID();
    private final UUID smallTwo = UUID.randomUUID();
    private final UUID large = UUID.randomUUID();

    VehicleShippingCapacityTest() {
        when(jdbc.queryForObject("select type from container where id = ?", String.class, smallOne))
                .thenReturn("STANDARD_20");
        when(jdbc.queryForObject("select type from container where id = ?", String.class, smallTwo))
                .thenReturn("STANDARD_20");
        when(jdbc.queryForObject("select type from container where id = ?", String.class, large))
                .thenReturn("STANDARD_40");
    }

    @Test
    void acceptsOneOrTwoSmallContainersAndOneLargeContainer() {
        assertThatCode(() -> references.validateVehicleShippingCapacity(List.of(container(smallOne))))
                .doesNotThrowAnyException();
        assertThatCode(() -> references.validateVehicleShippingCapacity(List.of(container(smallOne), container(smallTwo))))
                .doesNotThrowAnyException();
        assertThatCode(() -> references.validateVehicleShippingCapacity(List.of(container(large))))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsMixedAndOverCapacityLoads() {
        assertThatThrownBy(() -> references.validateVehicleShippingCapacity(List.of(container(smallOne), container(large))))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> references.validateVehicleShippingCapacity(List.of(container(large), container(large))))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> references.validateVehicleShippingCapacity(List.of(container(smallOne), container(smallTwo), container(smallOne))))
                .isInstanceOf(ApiException.class);
    }

    private static OrderContainerRequest container(UUID id) { return new OrderContainerRequest(id, true, null); }
}
