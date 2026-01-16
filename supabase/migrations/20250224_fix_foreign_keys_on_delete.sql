-- ============================================
-- MIGRACIÓN: Corregir Foreign Keys para permitir eliminación de asesores
-- Fecha: 2025-02-24
-- Descripción: Actualiza las foreign keys que referencian a GERSSON_ASESORES
-- para permitir eliminación con el comportamiento apropiado (CASCADE o SET NULL)
-- ============================================

-- 1. Actualizar foreign key en conversaciones (mantener historial, usar SET NULL)
-- NOTA: La constraint puede tener varios nombres: "id_asesor", "ids", etc.

-- Primero, hacer la columna nullable si no lo es
ALTER TABLE "public"."conversaciones" 
ALTER COLUMN "id_asesor" DROP NOT NULL;

-- Eliminar TODAS las constraints posibles con diferentes nombres
ALTER TABLE "public"."conversaciones" DROP CONSTRAINT IF EXISTS "id_asesor";
ALTER TABLE "public"."conversaciones" DROP CONSTRAINT IF EXISTS "ids";
ALTER TABLE "public"."conversaciones" DROP CONSTRAINT IF EXISTS "conversaciones_id_asesor_fkey";
ALTER TABLE "public"."conversaciones" DROP CONSTRAINT IF EXISTS "fk_id_asesor";
ALTER TABLE "public"."conversaciones" DROP CONSTRAINT IF EXISTS "conversaciones_asesor_fkey";

-- Crear nueva constraint con ON DELETE SET NULL
ALTER TABLE "public"."conversaciones" 
ADD CONSTRAINT "conversaciones_id_asesor_fkey" 
FOREIGN KEY ("id_asesor") 
REFERENCES "public"."GERSSON_ASESORES"("ID") 
ON DELETE SET NULL 
ON UPDATE NO ACTION;

-- 2. Actualizar foreign key en GERSSON_CUPOS_VIP (usar SET NULL para mantener datos)
DO $$
BEGIN
    -- Eliminar la constraint existente si existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_asesor_asignado'
        AND table_name = 'GERSSON_CUPOS_VIP'
    ) THEN
        ALTER TABLE "public"."GERSSON_CUPOS_VIP" 
        DROP CONSTRAINT "fk_asesor_asignado";
    END IF;
    
    -- Crear nueva constraint con ON DELETE SET NULL
    ALTER TABLE "public"."GERSSON_CUPOS_VIP" 
    ADD CONSTRAINT "fk_asesor_asignado" 
    FOREIGN KEY ("ASESOR_ASIGNADO") 
    REFERENCES "public"."GERSSON_ASESORES"("ID") 
    ON DELETE SET NULL 
    ON UPDATE NO ACTION;
END $$;

-- 3. Actualizar foreign key en GERSSON_REPORTES (mantener historial, usar RESTRICT o NO ACTION)
-- Los reportes son históricos importantes, así que no debemos eliminarlos automáticamente
-- Pero si el usuario quiere eliminar un asesor, debería verificar primero que no tenga reportes
-- Para este caso, mantenemos NO ACTION pero mejoramos el mensaje de error en el frontend

-- 4. Actualizar foreign key en lid_mappings si existe (usar SET NULL)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%asesor_id%'
        AND table_name = 'lid_mappings'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Eliminar la constraint existente
        ALTER TABLE "public"."lid_mappings" 
        DROP CONSTRAINT IF EXISTS "lid_mappings_asesor_id_fkey";
        
        -- Crear nueva constraint con ON DELETE SET NULL
        ALTER TABLE "public"."lid_mappings" 
        ADD CONSTRAINT "lid_mappings_asesor_id_fkey" 
        FOREIGN KEY ("asesor_id") 
        REFERENCES "public"."GERSSON_ASESORES"("ID") 
        ON DELETE SET NULL 
        ON UPDATE NO ACTION;
    END IF;
END $$;

-- Verificación: Mostrar todas las foreign keys hacia GERSSON_ASESORES
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'GERSSON_ASESORES'
ORDER BY tc.table_name, tc.constraint_name;
