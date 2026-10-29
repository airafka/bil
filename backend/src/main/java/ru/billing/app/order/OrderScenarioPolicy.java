package ru.billing.app.order;

import java.util.EnumSet;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import ru.billing.app.error.ApiException;

@Component
public class OrderScenarioPolicy {

    public static final String CONTAINER_AREA_CODE = "CONTAINER";
    private static final Set<TransportType> ALLOWED_TRANSPORT_TYPES =
            EnumSet.of(TransportType.VEHICLE, TransportType.RAILWAY);

    public void validate(String terminalAreaCode, TransportType transportType) {
        if (!CONTAINER_AREA_CODE.equals(terminalAreaCode)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "UNSUPPORTED_TERMINAL_AREA",
                    "В этом модуле доступна только контейнерная площадка"
            );
        }
        if (transportType == null || !ALLOWED_TRANSPORT_TYPES.contains(transportType)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "UNSUPPORTED_TRANSPORT_TYPE",
                    "Для контейнерной площадки выберите транспорт: Авто или ЖД"
            );
        }
    }
}
