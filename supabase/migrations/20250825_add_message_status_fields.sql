-- Migración para agregar campos de estado de mensaje a la tabla conversaciones
-- Fecha: 2025-08-25
-- Descripción: Añade campos mensaje_id y estado para el sistema de estados de mensajes WhatsApp

-- Agregar campo mensaje_id para almacenar el ID único del mensaje de WhatsApp
ALTER TABLE "public"."conversaciones" 
ADD COLUMN "mensaje_id" VARCHAR(255) NULL;

-- Agregar campo estado para almacenar el estado del mensaje (enviando, enviado, entregado, leido, error)
ALTER TABLE "public"."conversaciones" 
ADD COLUMN "estado" VARCHAR(20) NULL;

-- Crear índice en mensaje_id para búsquedas rápidas de actualización de estado
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_conversaciones_mensaje_id" 
ON "public"."conversaciones" ("mensaje_id") 
WHERE "mensaje_id" IS NOT NULL;

-- Crear índice en estado para filtros y consultas
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_conversaciones_estado" 
ON "public"."conversaciones" ("estado") 
WHERE "estado" IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN "public"."conversaciones"."mensaje_id" IS 'ID único del mensaje de WhatsApp para tracking de estados';
COMMENT ON COLUMN "public"."conversaciones"."estado" IS 'Estado del mensaje: enviando, enviado, entregado, leido, error';