package ru.billing.app.serviceorder;

public record ServiceProgress(String initialServiceName, String returnServiceName,
        int accepted, int shippingCreated, int shippingCompleted,
        int returnCreated, int returnCompleted, int total, int shippingMissing,
        int shippingOrderCount, int shippingOrdersCompleted, int returnOrderCount, int returnOrdersCompleted) {}
