package ru.billing.app.waybill;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WaybillService {

    private final WaybillValidator validator;
    private final WaybillReferenceValidator referenceValidator;
    private final WaybillStore store;
    private final GroupedWaybillStore groupedStore;

    public WaybillService(
            WaybillValidator validator,
            WaybillReferenceValidator referenceValidator,
            WaybillStore store,
            GroupedWaybillStore groupedStore
    ) {
        this.validator = validator;
        this.referenceValidator = referenceValidator;
        this.store = store;
        this.groupedStore = groupedStore;
    }

    @Transactional
    public CreatedWaybillResponse create(CreateWaybillRequest request) {
        CreateWaybillRequest normalized = validator.normalizeAndValidate(request);
        referenceValidator.validate(normalized);
        return store.create(normalized);
    }

    @Transactional(readOnly = true)
    public GroupedWaybillPage findGroupedPage(GroupedWaybillRequest request) {
        return groupedStore.findPage(request == null
                ? new GroupedWaybillRequest(null, null, null, null, false)
                : request);
    }
}
