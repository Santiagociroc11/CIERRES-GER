-- ============================================
-- MIGRACIÓN: Etiquetas personalizadas por asesor
-- Fecha: 2025-02-24
-- Descripción: Tabla para etiquetas que cada asesor puede crear y reutilizar
-- ============================================

-- 1. Crear tabla de etiquetas personalizadas
CREATE TABLE IF NOT EXISTS "public"."etiquetas_clientes" (
  "id" SERIAL PRIMARY KEY,
  "id_asesor" INTEGER NOT NULL REFERENCES "public"."GERSSON_ASESORES"("ID") ON DELETE CASCADE,
  "nombre" VARCHAR(50) NOT NULL,
  "color" VARCHAR(20) DEFAULT 'gray',
  "emoji" VARCHAR(10) DEFAULT NULL,
  "uso_count" INTEGER DEFAULT 0,
  "activo" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "unique_etiqueta_asesor" UNIQUE ("id_asesor", "nombre")
);

-- 2. Crear índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS "idx_etiquetas_asesor" 
ON "public"."etiquetas_clientes" ("id_asesor");

CREATE INDEX IF NOT EXISTS "idx_etiquetas_nombre" 
ON "public"."etiquetas_clientes" ("nombre");

CREATE INDEX IF NOT EXISTS "idx_etiquetas_uso" 
ON "public"."etiquetas_clientes" ("uso_count" DESC);

-- 3. Función para incrementar uso de etiqueta
CREATE OR REPLACE FUNCTION "public"."increment_etiqueta_uso"(etiqueta_id INTEGER)
RETURNS VOID LANGUAGE PLPGSQL AS $$
BEGIN
    UPDATE "public"."etiquetas_clientes"
    SET "uso_count" = "uso_count" + 1,
        "updated_at" = NOW()
    WHERE "id" = etiqueta_id;
END;
$$;

-- 4. Comentarios de documentación
COMMENT ON TABLE "public"."etiquetas_clientes" IS 'Etiquetas personalizadas creadas por cada asesor para clasificar leads';
COMMENT ON COLUMN "public"."etiquetas_clientes"."nombre" IS 'Nombre de la etiqueta (ej: "Sin dinero", "Interesado")';
COMMENT ON COLUMN "public"."etiquetas_clientes"."color" IS 'Color de la etiqueta: red, blue, green, yellow, purple, gray, etc.';
COMMENT ON COLUMN "public"."etiquetas_clientes"."emoji" IS 'Emoji opcional para la etiqueta';
COMMENT ON COLUMN "public"."etiquetas_clientes"."uso_count" IS 'Contador de veces que se ha usado la etiqueta';

-- 5. Verificación
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'etiquetas_clientes'
ORDER BY ordinal_position;
