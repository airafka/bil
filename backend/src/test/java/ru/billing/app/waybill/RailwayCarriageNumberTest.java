package ru.billing.app.waybill;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class RailwayCarriageNumberTest {
    @Test void controlDigitAndRange() {
        assertEquals("42000018",RailwayCarriageNumber.formatPlatform(4200001));
        assertEquals("42000026",RailwayCarriageNumber.formatPlatform(4200002));
        assertTrue(RailwayCarriageNumber.isValid("42000018"));
        assertFalse(RailwayCarriageNumber.isValid("42000016"));
        assertFalse(RailwayCarriageNumber.isValid("VGN-0001"));
        assertThrows(IllegalArgumentException.class,()->RailwayCarriageNumber.formatPlatform(4300000));
    }
}
