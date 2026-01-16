-- ============================================
-- MIGRACIÓN: Agregar temperatura y etiquetas a clientes
-- Fecha: 2025-02-24
-- Descripción: Campos para clasificar leads según temperatura (caliente/tibio/frío)
--              y etiquetas personalizadas para seguimientos
-- ============================================

-- 1. Agregar campo de temperatura en GERSSON_CLIENTES
ALTER TABLE "public"."GERSSON_CLIENTES" 
ADD COLUMN IF NOT EXISTS "temperatura" VARCHAR(20) DEFAULT NULL;

-- 2. Agregar campo de etiquetas (array como texto separado por comas)
ALTER TABLE "public"."GERSSON_CLIENTES" 
ADD COLUMN IF NOT EXISTS "etiquetas" TEXT DEFAULT NULL;

-- 3. Agregar campo de última actualización de temperatura
ALTER TABLE "public"."GERSSON_CLIENTES" 
ADD COLUMN IF NOT EXISTS "temperatura_fecha" BIGINT DEFAULT NULL;

-- 4. También agregar estos campos en GERSSON_REPORTES para historial
ALTER TABLE "public"."GERSSON_REPORTES" 
ADD COLUMN IF NOT EXISTS "temperatura" VARCHAR(20) DEFAULT NULL;

ALTER TABLE "public"."GERSSON_REPORTES" 
ADD COLUMN IF NOT EXISTS "etiquetas" TEXT DEFAULT NULL;

-- 5. Crear índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS "idx_clientes_temperatura" 
ON "public"."GERSSON_CLIENTES" ("temperatura");

CREATE INDEX IF NOT EXISTS "idx_reportes_temperatura" 
ON "public"."GERSSON_REPORTES" ("temperatura");

-- 6. Comentarios de documentación
COMMENT ON COLUMN "public"."GERSSON_CLIENTES"."temperatura" IS 'Temperatura del lead: CALIENTE, TIBIO, FRIO';
COMMENT ON COLUMN "public"."GERSSON_CLIENTES"."etiquetas" IS 'Etiquetas separadas por comas: precio,objeciones,sin_dinero,etc';
COMMENT ON COLUMN "public"."GERSSON_CLIENTES"."temperatura_fecha" IS 'Timestamp de última actualización de temperatura';
COMMENT ON COLUMN "public"."GERSSON_REPORTES"."temperatura" IS 'Temperatura asignada en este reporte';
COMMENT ON COLUMN "public"."GERSSON_REPORTES"."etiquetas" IS 'Etiquetas asignadas en este reporte';

-- 7. Verificación
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'GERSSON_CLIENTES' 
AND column_name IN ('temperatura', 'etiquetas', 'temperatura_fecha')
ORDER BY column_name;
