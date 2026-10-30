package ru.billing.app.serviceorder;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.billing.app.error.ApiException;
import static org.assertj.core.api.Assertions.*;

class ServiceOrderCargoPlannerTest {
    private final UUID container = UUID.randomUUID();
    private final UUID cargo = UUID.randomUUID();
    @Test void copiesCargoAndSubtractsCurrentReferenceTare() {
        var result = ServiceOrderCargoPlanner.plan(List.of(source("25000.125", "3400", cargo))).getFirst();
        assertThat(result.empty()).isFalse();
        assertThat(result.cargo().etsngCodeId()).isEqualTo(cargo);
        assertThat(result.cargo().weight()).isEqualByComparingTo("21600.125");
    }
    @Test void emptyContainerHasNoCargo() {
        var result = ServiceOrderCargoPlanner.plan(List.of(source("3200", "3200", null))).getFirst();
        assertThat(result.empty()).isTrue();
        assertThat(result.cargo()).isNull();
    }
    @Test void identicalRepeatedContainerCreatesOneRemoval() {
        var source = source("25000", "3200", cargo);
        assertThat(ServiceOrderCargoPlanner.plan(List.of(source, source))).hasSize(1);
    }
    @Test void conflictingCargoOrGrossIsRejected() {
        assertError(List.of(source("25000", "3200", cargo), source("26000", "3200", cargo)), "CONFLICTING_CONTAINER_CARGO");
        assertError(List.of(source("25000", "3200", cargo), source("25000", "3200", UUID.randomUUID())), "CONFLICTING_CONTAINER_CARGO");
    }
    @Test void missingCargoAndNegativeNetAreRejected() {
        assertError(List.of(source("25000", "3200", null)), "CONTAINER_CARGO_REQUIRED");
        assertError(List.of(source("3100", "3200", cargo)), "GROSS_BELOW_TARE");
    }
    @Test void copiesAttributesAndRejectsConflictingRepeatedContainers() {
        UUID owner = UUID.randomUUID(), seal = UUID.randomUUID();
        var source = new ServiceOrderCargoPlanner.SourceContainer(container, cargo, new BigDecimal("5000"), new BigDecimal("3200"), owner, "0001, 0002", seal);
        var result = ServiceOrderCargoPlanner.plan(List.of(source, source)).getFirst();
        assertThat(result.ownerClientId()).isEqualTo(owner);
        assertThat(result.sealNumbers()).isEqualTo("0001, 0002");
        assertThat(result.sealTypeId()).isEqualTo(seal);
        assertThat(result.hazardClassId()).isNull();
        assertError(List.of(source, new ServiceOrderCargoPlanner.SourceContainer(container, cargo, new BigDecimal("5000"), new BigDecimal("3200"), owner, "9999", seal)), "CONFLICTING_CONTAINER_ATTRIBUTES");
    }
    @Test void copiesHazardFromWaybillAndRejectsConflicts() {
        UUID hazard = UUID.randomUUID();
        var source = new ServiceOrderCargoPlanner.SourceContainer(container, cargo, new BigDecimal("5000"), new BigDecimal("3200"), null, null, null, hazard);
        assertThat(ServiceOrderCargoPlanner.plan(List.of(source)).getFirst().hazardClassId()).isEqualTo(hazard);
        var other = new ServiceOrderCargoPlanner.SourceContainer(container, cargo, new BigDecimal("5000"), new BigDecimal("3200"), null, null, null, UUID.randomUUID());
        assertError(List.of(source, other), "CONFLICTING_CONTAINER_ATTRIBUTES");
    }
    private ServiceOrderCargoPlanner.SourceContainer source(String gross, String tare, UUID code) {
        return new ServiceOrderCargoPlanner.SourceContainer(container, code, new BigDecimal(gross), new BigDecimal(tare));
    }
    private void assertError(List<ServiceOrderCargoPlanner.SourceContainer> rows, String code) {
        assertThatThrownBy(() -> ServiceOrderCargoPlanner.plan(rows)).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException)e).getCode()).isEqualTo(code);
    }
}
