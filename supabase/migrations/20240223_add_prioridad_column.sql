-- Añadir columna PRIORIDAD a la tabla GERSSON_ASESORES
ALTER TABLE "public"."GERSSON_ASESORES"
ADD COLUMN "PRIORIDAD" INTEGER NOT NULL DEFAULT 0;

-- Añadir índice para optimizar las consultas por prioridad
CREATE INDEX "idx_asesores_prioridad" ON "public"."GERSSON_ASESORES" ("PRIORIDAD" DESC);

-- Añadir comentario explicativo
COMMENT ON COLUMN "public"."GERSSON_ASESORES"."PRIORIDAD" IS 'Nivel de prioridad para asignación de clientes (mayor número = mayor prioridad)'; 