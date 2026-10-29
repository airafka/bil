package ru.billing.app.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import ru.billing.app.error.ApiException;
import ru.billing.app.reference.ReferenceDataService;
import ru.billing.app.route.RouteService;

class OrderServiceTest {

    private final OrderRequestValidator validator = new OrderRequestValidator();
    private final ReferenceDataService references = mock(ReferenceDataService.class);

    @Test
    void receivingOrderGetsGeneratedNumberAndDraftStatus() {
        ReceivingOrderStore store = mock(ReceivingOrderStore.class);
        ReceivingOrderService service = new ReceivingOrderService(validator, references, store, mock(RouteService.class));
        CreateOrderRequest request = validRequest();
        CreatedOrderResponse expected = new CreatedOrderResponse(UUID.randomUUID(), 17, "DRAFT");
        when(store.createVehicle(request)).thenReturn(expected);

        CreatedOrderResponse result = service.create(request);

        assertThat(result).isEqualTo(expected);
        verify(references).validateReferences(request);
        verify(store).createVehicle(request);
    }

    @Test
    void railwayReceivingOrderUsesWaybillsWithoutVehicleReferences() {
        ReceivingOrderStore store = mock(ReceivingOrderStore.class);
        ReceivingOrderService service = new ReceivingOrderService(validator, references, store, mock(RouteService.class));
        CreateOrderRequest request = new CreateOrderRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                TransportType.RAILWAY,
                List.of(),
                List.of(UUID.randomUUID(), UUID.randomUUID()),
                List.of(),
                FillingType.ALL,
                List.of(),
                List.of()
        );
        CreatedOrderResponse expected = new CreatedOrderResponse(UUID.randomUUID(), 18, "DRAFT");
        when(store.createRailway(request)).thenReturn(expected);

        assertThat(service.create(request)).isEqualTo(expected);
        verify(references).validateCommonReferences(request);
        verify(references, never()).validateReferences(request);
        verify(store).createRailway(request);
        verify(store, never()).createVehicle(request);
    }

    @Test
    void shippingOrderGetsGeneratedNumberAndDraftStatus() {
        ShippingOrderStore store = mock(ShippingOrderStore.class);
        ShippingOrderService service = new ShippingOrderService(validator, references, store, mock(RouteService.class));
        CreateOrderRequest request = validRequest();
        CreatedOrderResponse expected = new CreatedOrderResponse(UUID.randomUUID(), 9, "DRAFT");
        when(store.create(request)).thenReturn(expected);

        CreatedOrderResponse result = service.create(request);

        assertThat(result).isEqualTo(expected);
        verify(references).validateReferences(request);
        verify(store).create(request);
    }

    @Test
    void railwayShippingOrderUsesNestedReferences() {
        ShippingOrderStore store = mock(ShippingOrderStore.class);
        ShippingOrderService service = new ShippingOrderService(validator, references, store, mock(RouteService.class));
        CreateOrderRequest request = new CreateOrderRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                TransportType.RAILWAY,
                List.of(),
                List.of(),
                List.of(new ShippingOrderRailwayCarriageRequest(
                        UUID.randomUUID(),
                        List.of(new OrderContainerRequest(UUID.randomUUID(), true, null))
                )),
                FillingType.ALL,
                List.of(),
                List.of()
        );
        CreatedOrderResponse expected = new CreatedOrderResponse(UUID.randomUUID(), 10, "DRAFT");
        when(store.create(request)).thenReturn(expected);

        assertThat(service.create(request)).isEqualTo(expected);
        verify(references).validateShippingRailwayReferences(request);
        verify(references, never()).validateReferences(request);
        verify(store).create(request);
    }

    @Test
    void unnumberedVehicleShippingUsesExistingQuantityComposition() {
        ShippingOrderStore store = mock(ShippingOrderStore.class);
        ShippingOrderService service = new ShippingOrderService(validator, references, store, mock(RouteService.class));
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
        CreatedOrderResponse expected = new CreatedOrderResponse(UUID.randomUUID(), 11, "DRAFT");
        when(store.create(request)).thenReturn(expected);

        assertThat(service.create(request)).isEqualTo(expected);
        verify(references).validateReferences(request);
        verify(store).create(request);
    }

    @Test
    void receivingOrderIsNotWrittenWhenReferenceIsMissing() {
        ReceivingOrderStore store = mock(ReceivingOrderStore.class);
        ReceivingOrderService service = new ReceivingOrderService(validator, references, store, mock(RouteService.class));
        CreateOrderRequest request = validRequest();
        doThrow(new ApiException(HttpStatus.NOT_FOUND, "CLIENT_NOT_FOUND", "Клиент не найден"))
                .when(references).validateReferences(request);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getCode())
                .isEqualTo("CLIENT_NOT_FOUND");
        verify(store, never()).createVehicle(request);
        verify(store, never()).createRailway(request);
    }

    private CreateOrderRequest validRequest() {
        return new CreateOrderRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                TransportType.VEHICLE,
                List.of(new OrderContainerRequest(
                        UUID.randomUUID(),
                        false,
                        new CargoRequest(UUID.randomUUID(), new BigDecimal("12.500"))
                )),
                List.of(),
                List.of(),
                FillingType.ALL,
                List.of(),
                List.of()
        );
    }
}
