package ru.billing.app.waybill;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class ContainerNumberTest {
    @Test void publishedExamplesAndWrongDigits() {
        assertEquals("BICU1234565", ContainerNumber.format("BIC",123456));
        assertEquals("CSQU3054383", ContainerNumber.format("CSQ",305438));
        assertTrue(ContainerNumber.isValid("BICU1234565"));
        assertFalse(ContainerNumber.isValid("BICU1234566"));
        assertFalse(ContainerNumber.isValid("MVP20-ABC"));
        assertFalse(ContainerNumber.isValid("BICJ1234565"));
        assertFalse(ContainerNumber.isValid("bicU1234565"));
    }
    @Test void sixDigitsAndLimits() {
        assertTrue(ContainerNumber.format("TKR",1).startsWith("TKRU000001"));
        assertEquals(11,ContainerNumber.format("TKR",999999).length());
        assertThrows(IllegalArgumentException.class,()->ContainerNumber.format("TKR",1000000));
        assertThrows(IllegalArgumentException.class,()->ContainerNumber.format("TKR",-1));
        assertThrows(IllegalArgumentException.class,()->ContainerNumber.format("ТКР",1));
    }
}
