-- Migración para agregar funcionalidades avanzadas de chat
-- Fecha: 2025-08-25
-- Descripción: Añade tablas para respuestas rápidas y mensajes programados

-- 1. Tabla para respuestas rápidas (quick replies)
CREATE TABLE IF NOT EXISTS "public"."chat_quick_replies" (
  "id" SERIAL PRIMARY KEY,
  "id_asesor" INTEGER NOT NULL REFERENCES "public"."GERSSON_ASESORES"("ID") ON DELETE CASCADE,
  "texto" TEXT NOT NULL,
  "categoria" VARCHAR(50) DEFAULT 'general',
  "orden" INTEGER DEFAULT 0,
  "activo" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla para mensajes programados
CREATE TABLE IF NOT EXISTS "public"."chat_scheduled_messages" (
  "id" SERIAL PRIMARY KEY,
  "id_asesor" INTEGER NOT NULL REFERENCES "public"."GERSSON_ASESORES"("ID") ON DELETE CASCADE,
  "id_cliente" INTEGER NOT NULL REFERENCES "public"."GERSSON_CLIENTES"("ID") ON DELETE CASCADE,
  "wha_cliente" VARCHAR(30) NOT NULL,
  "mensaje" TEXT NOT NULL,
  "fecha_envio" TIMESTAMP WITH TIME ZONE NOT NULL,
  "estado" VARCHAR(20) DEFAULT 'pendiente', -- pendiente, enviado, cancelado, error
  "intentos" INTEGER DEFAULT 0,
  "max_intentos" INTEGER DEFAULT 3,
  "error_message" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "enviado_at" TIMESTAMP WITH TIME ZONE
);

-- 3. Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS "idx_quick_replies_asesor" ON "public"."chat_quick_replies"("id_asesor");
CREATE INDEX IF NOT EXISTS "idx_quick_replies_categoria" ON "public"."chat_quick_replies"("categoria");
CREATE INDEX IF NOT EXISTS "idx_quick_replies_activo" ON "public"."chat_quick_replies"("activo");

CREATE INDEX IF NOT EXISTS "idx_scheduled_messages_fecha" ON "public"."chat_scheduled_messages"("fecha_envio");
CREATE INDEX IF NOT EXISTS "idx_scheduled_messages_estado" ON "public"."chat_scheduled_messages"("estado");
CREATE INDEX IF NOT EXISTS "idx_scheduled_messages_cliente" ON "public"."chat_scheduled_messages"("id_cliente");
CREATE INDEX IF NOT EXISTS "idx_scheduled_messages_asesor" ON "public"."chat_scheduled_messages"("id_asesor");

-- 4. Insertar algunas respuestas rápidas de ejemplo para cada asesor
INSERT INTO "public"."chat_quick_replies" ("id_asesor", "texto", "categoria", "orden") 
SELECT 
  a."ID",
  'Hola! ¿En qué puedo ayudarte?',
  'saludo',
  1
FROM "public"."GERSSON_ASESORES" a
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."chat_quick_replies" qr 
  WHERE qr."id_asesor" = a."ID" AND qr."categoria" = 'saludo'
);

INSERT INTO "public"."chat_quick_replies" ("id_asesor", "texto", "categoria", "orden") 
SELECT 
  a."ID",
  'Perfecto! ¿Tienes alguna pregunta específica?',
  'seguimiento',
  2
FROM "public"."GERSSON_ASESORES" a
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."chat_quick_replies" qr 
  WHERE qr."id_asesor" = a."ID" AND qr."categoria" = 'seguimiento'
);

INSERT INTO "public"."chat_quick_replies" ("id_asesor", "texto", "categoria", "orden") 
SELECT 
  a."ID",
  '¡Excelente! Me alegra que te haya gustado.',
  'positivo',
  3
FROM "public"."GERSSON_ASESORES" a
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."chat_quick_replies" qr 
  WHERE qr."id_asesor" = a."ID" AND qr."categoria" = 'positivo'
);

-- 5. Comentarios para documentación
COMMENT ON TABLE "public"."chat_quick_replies" IS 'Respuestas rápidas predefinidas para cada asesor';
COMMENT ON TABLE "public"."chat_scheduled_messages" IS 'Mensajes programados para envío automático';
COMMENT ON COLUMN "public"."chat_quick_replies"."categoria" IS 'Categoría de la respuesta: saludo, seguimiento, positivo, etc.';
COMMENT ON COLUMN "public"."chat_scheduled_messages"."estado" IS 'Estado del mensaje: pendiente, enviado, cancelado, error';
