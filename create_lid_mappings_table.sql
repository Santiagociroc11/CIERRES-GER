-- Tabla para mapear LIDs a números de WhatsApp
-- Ejecutar en PostgreSQL/Supabase

CREATE TABLE "public"."lid_mappings" (
  "id" SERIAL PRIMARY KEY,
  "lid" VARCHAR(100) NOT NULL UNIQUE,
  "whatsapp_number" VARCHAR(20) NOT NULL,
  "id_cliente" INTEGER REFERENCES "GERSSON_CLIENTES"("ID"),
  "asesor_id" INTEGER REFERENCES "GERSSON_ASESORES"("ID"),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "last_seen" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX "idx_lid_mappings_lid" ON "public"."lid_mappings" ("lid");
CREATE INDEX "idx_lid_mappings_whatsapp" ON "public"."lid_mappings" ("whatsapp_number");
CREATE INDEX "idx_lid_mappings_cliente" ON "public"."lid_mappings" ("id_cliente");

-- Comentarios para documentación
COMMENT ON TABLE "public"."lid_mappings" IS 'Mapeo de LIDs de WhatsApp a números reales de clientes';
COMMENT ON COLUMN "public"."lid_mappings"."lid" IS 'LID de WhatsApp (ej: 98028484595727@lid)';
COMMENT ON COLUMN "public"."lid_mappings"."whatsapp_number" IS 'Número real de WhatsApp del cliente';
COMMENT ON COLUMN "public"."lid_mappings"."id_cliente" IS 'ID del cliente en GERSSON_CLIENTES';
COMMENT ON COLUMN "public"."lid_mappings"."asesor_id" IS 'ID del asesor que hizo el mapeo';
