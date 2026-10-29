package ru.billing.app.order;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import ru.billing.app.error.ApiException;

class OrderScenarioPolicyTest {

    private final OrderScenarioPolicy policy = new OrderScenarioPolicy();

    @Test
    void allowsBothTransportTypesForContainerArea() {
        assertThatCode(() -> policy.validate("CONTAINER", TransportType.VEHICLE)).doesNotThrowAnyException();
        assertThatCode(() -> policy.validate("CONTAINER", TransportType.RAILWAY)).doesNotThrowAnyException();
    }

    @Test
    void rejectsNonContainerArea() {
        assertThatThrownBy(() -> policy.validate("WAREHOUSE", TransportType.VEHICLE))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getCode())
                .isEqualTo("UNSUPPORTED_TERMINAL_AREA");
    }
}
