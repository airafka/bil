package ru.billing.app.waybill;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.billing.app.error.ApiException;
import static org.assertj.core.api.Assertions.*;

class WaybillValidatorTest {
    private final WaybillValidator validator = new WaybillValidator();
    @Test void trimsPayerAndNormalizesEmptyComposition() {
        var result = validator.normalizeAndValidate(new CreateWaybillRequest(null, 1, 2, "  Payer  ", null));
        assertThat(result.payer()).isEqualTo("Payer");
        assertThat(result.railwayCarriages()).isEmpty();
    }
    @Test void acceptsPreciseGrossWeight() {
        assertThatCode(() -> validator.normalizeAndValidate(request(new WaybillContainerRequest(UUID.randomUUID(), new BigDecimal("25000.125"), UUID.randomUUID())))).doesNotThrowAnyException();
    }
    @Test void rejectsMissingOrInvalidGrossWeight() {
        for (BigDecimal value : java.util.Arrays.asList(null, BigDecimal.ZERO, new BigDecimal("-1"))) {
            assertError(request(new WaybillContainerRequest(UUID.randomUUID(), value, null)), "GROSS_WEIGHT_REQUIRED");
        }
        assertError(request(new WaybillContainerRequest(UUID.randomUUID(), new BigDecimal("100.0001"), null)), "INVALID_WEIGHT_SCALE");
    }
    @Test void rejectsDuplicateContainersAcrossWagons() {
        var container = new WaybillContainerRequest(UUID.randomUUID(), new BigDecimal("5000"), UUID.randomUUID());
        assertError(new CreateWaybillRequest(null, 1, 2, "P", List.of(
                new WaybillRailwayCarriageRequest(UUID.randomUUID(), List.of(container)),
                new WaybillRailwayCarriageRequest(UUID.randomUUID(), List.of(container)))), "DUPLICATE_CONTAINER");
    }
    @Test void rejectsRequiredFields() {
        assertError(new CreateWaybillRequest(null, 1, 2, " ", List.of()), "PAYER_REQUIRED");
        assertError(new CreateWaybillRequest(null, null, 2, "P", List.of()), "DEPARTURE_STATION_REQUIRED");
        assertError(new CreateWaybillRequest(null, 1, null, "P", List.of()), "DESTINATION_STATION_REQUIRED");
    }
    private CreateWaybillRequest request(WaybillContainerRequest container) {
        return new CreateWaybillRequest(null, 1, 2, "P", List.of(new WaybillRailwayCarriageRequest(UUID.randomUUID(), List.of(container))));
    }
    private void assertError(CreateWaybillRequest request, String code) {
        assertThatThrownBy(() -> validator.normalizeAndValidate(request)).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException)e).getCode()).isEqualTo(code);
    }
}
