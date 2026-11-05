package ru.billing.app.reference;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import ru.billing.app.error.ApiException;

@Service
public class TransportCatalogService {
    private final JdbcTemplate jdbc;
    public TransportCatalogService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Entry(UUID id, String name, boolean active, String phoneNumber, String poaNumber,
        LocalDate poaValidTo, String insuranceNumber, Boolean withTrailer, String trailerNumber) {}
    public record Input(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=255) String name,
        @jakarta.validation.constraints.NotNull Boolean active,
        @jakarta.validation.constraints.Size(max=30) String phoneNumber,
        @jakarta.validation.constraints.Size(max=100) String poaNumber, LocalDate poaValidTo,
        @jakarta.validation.constraints.Size(max=100) String insuranceNumber, Boolean withTrailer,
        @jakarta.validation.constraints.Size(max=20) String trailerNumber) {}
    public static String table(String kind) {
        return switch(kind) { case "carriers" -> "client_related_entity"; case "drivers" -> "client_driver";
            case "vehicles" -> "client_vehicle"; default -> throw new ApiException(HttpStatus.NOT_FOUND,"CATALOG_NOT_FOUND","Справочник не найден"); };
    }
    private String query(String kind) {
        return "select id,"+(kind.equals("carriers")?"name":"code")+" as name,active,"
            +(kind.equals("drivers")?"phone_number,poa_number,poa_valid_to,":"null::text as phone_number,null::text as poa_number,null::date as poa_valid_to,")
            +(kind.equals("vehicles")?"insurance_number,with_trailer,trailer_number":"null::text as insurance_number,null::boolean as with_trailer,null::text as trailer_number")
            +" from "+table(kind);
    }
    private Entry row(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Entry(rs.getObject("id",UUID.class),rs.getString("name"),rs.getBoolean("active"),rs.getString("phone_number"),
            rs.getString("poa_number"),rs.getObject("poa_valid_to",LocalDate.class),rs.getString("insurance_number"),
            rs.getObject("with_trailer",Boolean.class),rs.getString("trailer_number"));
    }
    @Transactional(readOnly=true)
    public List<Entry> list(String kind, boolean activeOnly) {
        return jdbc.query(query(kind)+" where "+(kind.equals("carriers")?"not transport_catalog_archived":"true")+(activeOnly?" and active":"")+" order by name,id",(rs,n)->row(rs));
    }
    @Transactional(readOnly=true)
    public Entry get(String kind, UUID id) {
        return jdbc.query(query(kind)+" where id=?"+(kind.equals("carriers")?" and not transport_catalog_archived":""),(rs,n)->row(rs),id).stream().findFirst()
            .orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"CATALOG_ENTRY_NOT_FOUND","Запись не найдена"));
    }
    private static String clean(String value) { return value==null||value.isBlank()?null:value.trim(); }
    public static String plate(String value) {
        String s=clean(value); if(s==null)return null; s=s.toUpperCase(java.util.Locale.ROOT).replaceAll("[\\s-]","");
        String latin="ABEKMHOPCTYX",cyrillic="АВЕКМНОРСТУХ";
        StringBuilder out=new StringBuilder();for(char c:s.toCharArray()){int i=latin.indexOf(c);out.append(i<0?c:cyrillic.charAt(i));}return out.toString();
    }
    @Transactional
    public Entry save(String kind, UUID id, Input input) {
        String table=table(kind); Entry old=null;
        if(id!=null){ jdbc.queryForList("select id from "+table+" where id=? for update",id);old=get(kind,id); }
        String name=clean(input.name()), phone=clean(input.phoneNumber()),trailer=plate(input.trailerNumber());
        if(name==null)throw new ApiException(HttpStatus.BAD_REQUEST,"NAME_REQUIRED","Заполните наименование");
        if(kind.equals("drivers") && phone!=null && !phone.matches("\\+7[0-9]{10}"))
            throw new ApiException(HttpStatus.BAD_REQUEST,"PHONE_FORMAT","Телефон: +7 и 10 цифр");
        if(kind.equals("vehicles")) {
            name=plate(name);
            if((old==null || !name.equals(old.name())) && !name.matches("[АВЕКМНОРСТУХ][0-9]{3}[АВЕКМНОРСТУХ]{2}[0-9]{2,3}"))
                throw new ApiException(HttpStatus.BAD_REQUEST,"VEHICLE_NUMBER_FORMAT","Номер ТС: А123ВС777");
            if(Boolean.TRUE.equals(input.withTrailer()) && (trailer==null || !trailer.matches("[АВЕКМНОРСТУХ]{2}[0-9]{4}[0-9]{2,3}")))
                throw new ApiException(HttpStatus.BAD_REQUEST,"TRAILER_NUMBER_FORMAT","Укажите номер прицепа: АВ1234777");
            if(!Boolean.TRUE.equals(input.withTrailer()))trailer=null;
        }
        UUID saved=id==null?UUID.randomUUID():id;
        String column=kind.equals("carriers")?"name":"code";
        if(id==null) jdbc.update("insert into "+table+"(id,"+column+",active) values(?,?,?)",saved,name,input.active());
        else jdbc.update("update "+table+" set "+column+"=?,active=? where id=?",name,input.active(),saved);
        if(kind.equals("drivers"))jdbc.update("update client_driver set phone_number=?,poa_number=?,poa_valid_to=? where id=?",phone,clean(input.poaNumber()),input.poaValidTo(),saved);
        if(kind.equals("vehicles"))jdbc.update("update client_vehicle set insurance_number=?,with_trailer=?,trailer_number=? where id=?",clean(input.insuranceNumber()),input.withTrailer(),trailer,saved);
        return get(kind,saved);
    }
    @Transactional
    public void delete(String kind,UUID id) { get(kind,id);jdbc.update("delete from "+table(kind)+" where id=?",id); }
    public void requireSelectable(String kind, UUID id, UUID previousId) {
        if(id==null)throw new ApiException(HttpStatus.BAD_REQUEST,"ROUTE_VEHICLE_DETAILS_REQUIRED","Выберите перевозчика, водителя и ТС");
        List<Boolean> rows=jdbc.query("select active from "+table(kind)+" where id=?"+(kind.equals("carriers")?" and not transport_catalog_archived":"")+" for share",(rs,n)->rs.getBoolean(1),id);
        if(rows.isEmpty() || (!rows.getFirst() && !id.equals(previousId)))
            throw new ApiException(HttpStatus.CONFLICT,"ROUTE_REFERENCE_INACTIVE","Выбранная запись справочника отсутствует или неактивна");
    }
}
