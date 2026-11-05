package ru.billing.app.reference;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Resolve the existing text inputs to the same relation columns as the main system. */
public final class PartyReferences {
    private PartyReferences() {}

    public static UUID party(JdbcTemplate jdbc, String name) {
        if (name == null || name.isBlank()) return null;
        return jdbc.queryForObject("""
                insert into client_related_entity(id,name)
                values(coalesce((select id from client where name=?),?),?)
                on conflict(name) do update set name=excluded.name returning id
                """, UUID.class, name.trim(), UUID.randomUUID(), name.trim());
    }

    /** Cargo parties must come from the client directory; arbitrary text is not a new client. */
    public static String clientName(JdbcTemplate jdbc, String name) {
        if (name == null || name.isBlank()) return null;
        var names = jdbc.queryForList("select name from client where lower(name)=lower(?)", String.class, name.trim());
        if (names.isEmpty()) throw new ru.billing.app.error.ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "CARGO_PARTY_CLIENT_NOT_FOUND",
                "Выберите грузоотправителя или грузополучателя из справочника клиентов");
        return names.getFirst();
    }

    public static UUID clientParty(JdbcTemplate jdbc, String name) {
        String canonical = clientName(jdbc, name);
        if (canonical == null) return null;
        // Keep the existing consignee relation, without adding cargo parties to carrier choices.
        return jdbc.queryForObject("""
                insert into client_related_entity(id,name,active,transport_catalog_archived)
                select id,name,false,true from client where name=?
                on conflict(name) do update set name=excluded.name returning id
                """, UUID.class, canonical);
    }

    public static UUID driver(JdbcTemplate jdbc, String code) { return code(jdbc, "client_driver", code); }
    public static UUID vehicle(JdbcTemplate jdbc, String code) { return code(jdbc, "client_vehicle", code); }
    private static UUID code(JdbcTemplate jdbc, String table, String value) {
        if (value == null || value.isBlank()) return null;
        return jdbc.queryForObject("insert into " + table + "(id,code) values(?,?) on conflict(code) do update set code=excluded.code returning id",
                UUID.class, UUID.randomUUID(), value.trim());
    }
}
