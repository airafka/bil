package ru.billing.app.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class ShippingOrderStoreTest {

    @Test
    void storesUnnumberedVehicleContainerInExistingQuantityTable() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ShippingOrderStore store = new ShippingOrderStore(jdbcTemplate);
        CreateOrderRequest request = new CreateOrderRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                TransportType.VEHICLE,
                List.of(),
                List.of(),
                List.of(),
                FillingType.VEHICLE_UNNUMBERED,
                List.of(),
                List.of(new ContainerQuantityRequest(1, ContainerType.STANDARD_40, true, List.of()))
        );
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(101);

        CreatedOrderResponse response = store.create(request);

        assertThat(response.code()).isEqualTo(101);
        verify(jdbcTemplate).update(
                startsWith("insert into shipping_order_container_qty"),
                any(), any(), eq(1), eq("STANDARD_40"), eq(true)
        );
        verify(jdbcTemplate, never()).update(
                startsWith("insert into shipping_order_container "),
                any(), any(), any(), any(), any()
        );
    }
}
