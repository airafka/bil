package ru.billing.app.waybill;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import ru.billing.app.error.ApiException;

class WaybillServiceTest {

    @Test
    void referenceFailurePreventsAnyWrite() {
        WaybillValidator validator = mock(WaybillValidator.class);
        WaybillReferenceValidator references = mock(WaybillReferenceValidator.class);
        WaybillStore store = mock(WaybillStore.class);
        GroupedWaybillStore groupedStore = mock(GroupedWaybillStore.class);
        WaybillService service = new WaybillService(validator, references, store, groupedStore);
        CreateWaybillRequest request = new CreateWaybillRequest(
                null, 1, 2, "P", List.of()
        );
        when(validator.normalizeAndValidate(request)).thenReturn(request);
        org.mockito.Mockito.doThrow(new ApiException(HttpStatus.NOT_FOUND, "REFERENCE_NOT_FOUND", "Нет ссылки"))
                .when(references).validate(request);

        assertThatThrownBy(() -> service.create(request)).isInstanceOf(ApiException.class);
        verify(store, never()).create(request);
    }
}
