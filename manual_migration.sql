-- EJECUTAR ESTOS COMANDOS MANUALMENTE EN LA BASE DE DATOS
-- Migración para agregar campos de estado de mensaje a la tabla conversaciones

-- 1. Agregar campo mensaje_id
ALTER TABLE "public"."conversaciones" 
ADD COLUMN IF NOT EXISTS "mensaje_id" VARCHAR(255) NULL;

-- 2. Agregar campo estado 
ALTER TABLE "public"."conversaciones" 
ADD COLUMN IF NOT EXISTS "estado" VARCHAR(20) NULL;

-- 3. Crear índice en mensaje_id (opcional, para performance)
CREATE INDEX IF NOT EXISTS "idx_conversaciones_mensaje_id" 
ON "public"."conversaciones" ("mensaje_id") 
WHERE "mensaje_id" IS NOT NULL;

-- 4. Crear índice en estado (opcional, para performance)
CREATE INDEX IF NOT EXISTS "idx_conversaciones_estado" 
ON "public"."conversaciones" ("estado") 
WHERE "estado" IS NOT NULL;

-- 5. Agregar comentarios (opcional)
COMMENT ON COLUMN "public"."conversaciones"."mensaje_id" IS 'ID único del mensaje de WhatsApp para tracking de estados';
COMMENT ON COLUMN "public"."conversaciones"."estado" IS 'Estado del mensaje: enviando, enviado, entregado, leido, error';

-- Verificar que los campos se agregaron correctamente:
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'conversaciones' 
AND table_schema = 'public'
ORDER BY ordinal_position;