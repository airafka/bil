package ru.billing.app.waybill;

import java.util.Locale;

/** ISO 6346 freight-container identifier; registration/physical ownership is separate. */
public final class ContainerNumber {
    private ContainerNumber() {}
    private static final int[] LETTER_VALUES = {10,12,13,14,15,16,17,18,19,20,21,23,24,25,26,27,28,29,30,31,32,34,35,36,37,38};

    public static String format(String owner, int serial) {
        if (owner == null || !owner.matches("[A-Z]{3}") || serial < 0 || serial > 999999)
            throw new IllegalArgumentException("Owner must be three Latin capitals and serial must contain six digits");
        String body = owner + "U" + String.format(Locale.ROOT, "%06d", serial);
        return body + checkDigit(body);
    }
    public static int checkDigit(String body) {
        if (body == null || !body.matches("[A-Z]{3}U[0-9]{6}"))
            throw new IllegalArgumentException("Expected ten-character freight-container identifier");
        int sum = 0;
        for (int i=0; i<body.length(); i++) {
            char c=body.charAt(i);
            int value=c>='A' && c<='Z' ? LETTER_VALUES[c-'A'] : c-'0';
            sum += value * (1 << i);
        }
        return (sum % 11) % 10;
    }
    public static boolean isValid(String number) {
        return number != null && number.matches("[A-Z]{3}U[0-9]{7}")
            && checkDigit(number.substring(0,10)) == number.charAt(10)-'0';
    }
}
