-- ============================================
-- MIGRACIÓN: Agregar Foreign Key entre GERSSON_REPORTES y GERSSON_CLIENTES
-- Fecha: 2025-02-24
-- Descripción: Agrega la foreign key faltante para permitir selects anidados en PostgREST
-- ============================================

-- Agregar foreign key de GERSSON_REPORTES.ID_CLIENTE hacia GERSSON_CLIENTES.ID
ALTER TABLE "public"."GERSSON_REPORTES" 
ADD CONSTRAINT "GERSSON_REPORTES_ID_CLIENTE_fkey" 
FOREIGN KEY ("ID_CLIENTE") 
REFERENCES "public"."GERSSON_CLIENTES"("ID") 
ON DELETE NO ACTION 
ON UPDATE NO ACTION;

-- Agregar foreign key de GERSSON_REPORTES.ID_ASESOR hacia GERSSON_ASESORES.ID (si no existe)
-- Esto también es útil para selects anidados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'GERSSON_REPORTES_ID_ASESOR_fkey'
        AND table_name = 'GERSSON_REPORTES'
    ) THEN
        ALTER TABLE "public"."GERSSON_REPORTES" 
        ADD CONSTRAINT "GERSSON_REPORTES_ID_ASESOR_fkey" 
        FOREIGN KEY ("ID_ASESOR") 
        REFERENCES "public"."GERSSON_ASESORES"("ID") 
        ON DELETE NO ACTION 
        ON UPDATE NO ACTION;
    END IF;
END $$;

-- Verificación: Mostrar las foreign keys creadas
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'GERSSON_REPORTES'
ORDER BY tc.constraint_name;
