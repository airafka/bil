package ru.billing.app.billing;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class BillingServiceTest {
    @Test void selectsByActualContainerCount(){
        assertEquals("A_WAGON",BillingService.purposeForCount(39));
        assertEquals("A_TRAIN",BillingService.purposeForCount(40));
        assertEquals("A_TRAIN",BillingService.purposeForCount(41));
        assertThrows(RuntimeException.class,()->BillingService.purposeForCount(0));
    }
    @Test void calculatesIndependentPricesAndRoundsHalfUp(){
        assertEquals(new BigDecimal("18800.00"),BillingService.price(new BigDecimal("23500"),new BigDecimal("0.8")));
        assertEquals(new BigDecimal("22936.00"),BillingService.price(new BigDecimal("28670"),new BigDecimal("0.8")));
        assertEquals(new BigDecimal("1.01"),BillingService.price(new BigDecimal("1.005"),BigDecimal.ONE));
    }
}
