-- La función get_next_asesor_ponderado() ya existe en la BD con lógica de pesos dinámicos
-- No necesitamos recrearla

-- Función para incrementar contadores de asesores
CREATE OR REPLACE FUNCTION increment_asesor_counter(asesor_id INTEGER, counter_field TEXT)
RETURNS VOID AS $$
BEGIN
    CASE counter_field
        WHEN 'CARRITOS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "CARRITOS" = "CARRITOS" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'RECHAZADOS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "RECHAZADOS" = "RECHAZADOS" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'TICKETS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "TICKETS" = "TICKETS" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'COMPRAS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "COMPRAS" = "COMPRAS" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'LINK' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "LINK" = "LINK" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'MASIVOS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "MASIVOS" = "MASIVOS" + 1 
            WHERE "ID" = asesor_id;
    END CASE;
END;
$$ LANGUAGE plpgsql;