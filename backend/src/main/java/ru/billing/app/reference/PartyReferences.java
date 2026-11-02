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

    public static UUID driver(JdbcTemplate jdbc, String code) { return code(jdbc, "client_driver", code); }
    public static UUID vehicle(JdbcTemplate jdbc, String code) { return code(jdbc, "client_vehicle", code); }
    private static UUID code(JdbcTemplate jdbc, String table, String value) {
        if (value == null || value.isBlank()) return null;
        return jdbc.queryForObject("insert into " + table + "(id,code) values(?,?) on conflict(code) do update set code=excluded.code returning id",
                UUID.class, UUID.randomUUID(), value.trim());
    }
}
