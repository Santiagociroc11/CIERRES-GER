-- Add prioridad column to GERSSON_ASESORES table
ALTER TABLE "public"."GERSSON_ASESORES"
ADD COLUMN "PRIORIDAD" INTEGER DEFAULT 0;
 
-- Add comment to explain the column
COMMENT ON COLUMN "public"."GERSSON_ASESORES"."PRIORIDAD" IS 'Prioridad del asesor para asignación de clientes. Mayor número = mayor prioridad'; 