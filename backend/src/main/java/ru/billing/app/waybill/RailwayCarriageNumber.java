package ru.billing.app.waybill;
public final class RailwayCarriageNumber {
    private RailwayCarriageNumber() {}
    public static String formatPlatform(int body) {
        if(body<4200000 || body>4299999) throw new IllegalArgumentException("Platform demo range is 4200000..4299999");
        String value=Integer.toString(body);
        return value+checkDigit(value);
    }
    public static int checkDigit(String body) {
        if(body==null || !body.matches("[0-9]{7}")) throw new IllegalArgumentException("Expected seven digits");
        int sum=0;
        for(int i=0;i<7;i++) { int value=(body.charAt(i)-'0')*(i%2==0?2:1); sum+=value/10+value%10; }
        return (10-sum%10)%10;
    }
    public static boolean isValid(String value) {
        return value!=null && value.matches("[0-9]{8}") && checkDigit(value.substring(0,7))==value.charAt(7)-'0';
    }
}
