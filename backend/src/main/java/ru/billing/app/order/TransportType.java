package ru.billing.app.order;

public enum TransportType {
    VEHICLE("Авто"),
    RAILWAY("ЖД");

    private final String displayName;

    TransportType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
