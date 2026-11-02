package ru.billing.app.order;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ru.billing.app.error.ApiException;

class OrderRequestValidatorTest {

    private static final UUID CLIENT_ID = UUID.randomUUID();
    private static final UUID TERMINAL_AREA_ID = UUID.randomUUID();
    private static final UUID CONTAINER_ONE = UUID.randomUUID();
    private static final UUID CONTAINER_TWO = UUID.randomUUID();
    private static final UUID ETSNG_ID = UUID.randomUUID();
    private static final UUID WAYBILL_ONE = UUID.randomUUID();

    private final OrderRequestValidator validator = new OrderRequestValidator();

    @Test
    void acceptsContainerAreaWithVehicle() {
        assertThatCode(() -> validator.validate(request(TransportType.VEHICLE, loaded(CONTAINER_ONE))))
                .doesNotThrowAnyException();
    }

    @Test
    void acceptsContainerAreaWithRailway() {
        assertThatCode(() -> validator.validate(new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                TransportType.RAILWAY,
                List.of(),
                List.of(WAYBILL_ONE),
                List.of(),
                FillingType.ALL,
                List.of(),
                List.of()
        )))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsMissingTerminalArea() {
        assertError(new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                null,
                TransportType.VEHICLE,
                List.of(empty(CONTAINER_ONE)),
                List.of(),
                List.of(),
                FillingType.ALL,
                List.of(),
                List.of()
        ), "TERMINAL_AREA_REQUIRED");
    }

    @Test
    void rejectsMissingTransportType() {
        assertError(new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                null,
                List.of(empty(CONTAINER_ONE)),
                List.of(),
                List.of(),
                FillingType.ALL,
                List.of(),
                List.of()
        ), "TRANSPORT_TYPE_REQUIRED");
    }

    @Test
    void acceptsMixedContainers() {
        assertThatCode(() -> validator.validate(vehicleRequest(
                List.of(empty(CONTAINER_ONE), loaded(CONTAINER_TWO)), List.of(), List.of()
        ))).doesNotThrowAnyException();
    }

    @Test
    void rejectsEmptyContainerList() {
        assertError(vehicleRequest(List.of(), List.of(), List.of()), "EMPTY_CONTAINER_LIST");
    }

    @Test
    void rejectsDuplicateContainer() {
        assertError(vehicleRequest(
                List.of(empty(CONTAINER_ONE), empty(CONTAINER_ONE)), List.of(), List.of()
        ), "DUPLICATE_CONTAINER");
    }

    @Test
    void rejectsCargoForEmptyContainer() {
        assertError(request(TransportType.VEHICLE, new OrderContainerRequest(
                CONTAINER_ONE, true, new CargoRequest(ETSNG_ID, BigDecimal.ONE)
        )), "CARGO_FOR_EMPTY_CONTAINER");
    }

    @Test
    void rejectsMissingCargoForLoadedContainer() {
        assertError(request(
                TransportType.VEHICLE,
                new OrderContainerRequest(CONTAINER_ONE, false, null)
        ), "CARGO_REQUIRED");
    }

    @Test
    void rejectsNonPositiveWeight() {
        assertError(request(TransportType.VEHICLE, new OrderContainerRequest(
                CONTAINER_ONE, false, new CargoRequest(ETSNG_ID, BigDecimal.ZERO)
        )), "INVALID_WEIGHT");
    }

    @Test
    void rejectsWaybillsForVehicle() {
        assertError(vehicleRequest(
                List.of(empty(CONTAINER_ONE)), List.of(WAYBILL_ONE), List.of()
        ), "WAYBILLS_NOT_ALLOWED_FOR_VEHICLE");
    }

    @Test
    void rejectsContainersForRailway() {
        assertError(new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                TransportType.RAILWAY,
                List.of(empty(CONTAINER_ONE)),
                List.of(WAYBILL_ONE),
                List.of(),
                FillingType.ALL,
                List.of(),
                List.of()
        ), "CONTAINERS_NOT_ALLOWED_FOR_RAILWAY");
    }

    @Test
    void rejectsEmptyAndDuplicateRailwayWaybills() {
        assertError(new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                TransportType.RAILWAY,
                List.of(),
                List.of(),
                List.of(),
                FillingType.ALL,
                List.of(),
                List.of()
        ), "EMPTY_WAYBILL_LIST");
        assertError(new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                TransportType.RAILWAY,
                List.of(),
                List.of(WAYBILL_ONE, WAYBILL_ONE),
                List.of(),
                FillingType.ALL,
                List.of(),
                List.of()
        ), "DUPLICATE_WAYBILL");
    }

    @Test
    void acceptsRailwayShipping() {
        CreateOrderRequest request = new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                TransportType.RAILWAY,
                List.of(),
                List.of(),
                List.of(new ShippingOrderRailwayCarriageRequest(
                        UUID.randomUUID(),
                        List.of(empty(CONTAINER_ONE))
                )),
                FillingType.ALL,
                List.of(),
                List.of()
        );
        assertThatCode(() -> validator.validateShipping(request)).doesNotThrowAnyException();
    }

    @Test
    void rejectsInvalidRailwayShippingComposition() {
        UUID carriage = UUID.randomUUID();
        assertShippingError(List.of(), List.of(), "RAILWAY_CARRIAGES_REQUIRED");
        assertShippingError(List.of(new ShippingOrderRailwayCarriageRequest(carriage, List.of())), List.of(), "EMPTY_RAILWAY_CARRIAGE");
        assertShippingError(List.of(
                new ShippingOrderRailwayCarriageRequest(carriage, List.of(empty(CONTAINER_ONE))),
                new ShippingOrderRailwayCarriageRequest(carriage, List.of(empty(CONTAINER_TWO)))
        ), List.of(), "DUPLICATE_RAILWAY_CARRIAGE");
        assertShippingError(List.of(
                new ShippingOrderRailwayCarriageRequest(carriage, List.of(empty(CONTAINER_ONE))),
                new ShippingOrderRailwayCarriageRequest(UUID.randomUUID(), List.of(empty(CONTAINER_ONE)))
        ), List.of(), "DUPLICATE_CONTAINER");
        assertShippingError(
                List.of(new ShippingOrderRailwayCarriageRequest(carriage, List.of(empty(CONTAINER_ONE)))),
                List.of(empty(CONTAINER_TWO)),
                "CONTAINERS_NOT_ALLOWED_FOR_RAILWAY"
        );
    }















    private CreateOrderRequest request(TransportType transportType, OrderContainerRequest container) {
        if (transportType == TransportType.VEHICLE) {
            return vehicleRequest(List.of(container), List.of(), List.of());
        }
        return new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                transportType,
                List.of(container),
                List.of(),
                List.of(),
                FillingType.ALL,
                List.of(),
                List.of()
        );
    }

    private CreateOrderRequest vehicleRequest(
            List<OrderContainerRequest> containers,
            List<UUID> waybillIds,
            List<ShippingOrderRailwayCarriageRequest> railwayCarriages
    ) {
        return new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                TransportType.VEHICLE,
                containers,
                waybillIds,
                railwayCarriages,
                FillingType.ALL,
                List.of(),
                List.of()
        );
    }

    private CreateOrderRequest unnumberedVehicleRequest(
            List<OrderContainerRequest> containers,
            List<ContainerQuantityRequest> containerQuantities
    ) {
        return new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                TransportType.VEHICLE,
                containers,
                List.of(),
                List.of(),
                FillingType.VEHICLE_UNNUMBERED,
                List.of(),
                containerQuantities
        );
    }

    private void assertShippingError(
            List<ShippingOrderRailwayCarriageRequest> railwayCarriages,
            List<OrderContainerRequest> containers,
            String expectedCode
    ) {
        CreateOrderRequest request = new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                TransportType.RAILWAY,
                containers,
                List.of(),
                railwayCarriages,
                FillingType.ALL,
                List.of(),
                List.of()
        );
        assertThatThrownBy(() -> validator.validateShipping(request))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getCode())
                .isEqualTo(expectedCode);
    }

    private void assertShippingError(CreateOrderRequest request, String expectedCode) {
        assertThatThrownBy(() -> validator.validateShipping(request))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getCode())
                .isEqualTo(expectedCode);
    }

    private CreateOrderRequest shippingRequest(
            FillingType fillingType,
            List<ShippingOrderRailwayCarriageRequest> railwayCarriages,
            List<OrderContainerRequest> containers,
            List<RailwayCarriageQuantityRequest> carriageQuantities,
            List<ContainerQuantityRequest> containerQuantities
    ) {
        return new CreateOrderRequest(
                CLIENT_ID,
                UUID.randomUUID(),
                TERMINAL_AREA_ID,
                TransportType.RAILWAY,
                containers,
                List.of(),
                railwayCarriages,
                fillingType,
                carriageQuantities,
                containerQuantities
        );
    }

    private OrderContainerRequest loaded(UUID containerId) {
        return new OrderContainerRequest(
                containerId,
                false,
                new CargoRequest(ETSNG_ID, new BigDecimal("24500.000"))
        );
    }

    private OrderContainerRequest empty(UUID containerId) {
        return new OrderContainerRequest(containerId, true, null);
    }

    private void assertError(CreateOrderRequest request, String expectedCode) {
        assertThatThrownBy(() -> validator.validate(request))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getCode())
                .isEqualTo(expectedCode);
    }

    @Test
    void rejectsAllModesWithoutFullNumbers() {
        for (FillingType type : FillingType.values()) {
            if(type == FillingType.ALL) continue;
            for(TransportType transport : new TransportType[]{TransportType.VEHICLE, TransportType.RAILWAY}) {
                CreateOrderRequest request = new CreateOrderRequest(CLIENT_ID, UUID.randomUUID(), TERMINAL_AREA_ID, transport, List.of(), List.of(), List.of(), type, List.of(), List.of());
                assertThatThrownBy(() -> validator.validateShipping(request)).isInstanceOfSatisfying(ApiException.class, ex -> org.assertj.core.api.Assertions.assertThat(ex.getCode()).isEqualTo("NUMBERED_COMPOSITION_REQUIRED"));
                assertThatThrownBy(() -> validator.validate(request)).isInstanceOf(ApiException.class);
            }
        }
    }

    @Test
    void rejectsQuantitiesEvenWithAllFillingType() {
        CreateOrderRequest request = new CreateOrderRequest(CLIENT_ID, UUID.randomUUID(), TERMINAL_AREA_ID, TransportType.RAILWAY, List.of(), List.of(), List.of(), FillingType.ALL, List.of(new RailwayCarriageQuantityRequest(1, null)), List.of());
        assertThatThrownBy(() -> validator.validateShipping(request)).isInstanceOfSatisfying(ApiException.class, ex -> org.assertj.core.api.Assertions.assertThat(ex.getCode()).isEqualTo("NUMBERED_COMPOSITION_REQUIRED"));
    }
}

