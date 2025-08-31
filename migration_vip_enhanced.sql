-- ============================================
-- MIGRACIÓN SIMPLE: Solo campos esenciales para GERSSON_CUPOS_VIP
-- Fecha: 2025-08-31
-- Descripción: Solo relación VIP-Cliente
-- ============================================

-- 1. Agregar solo las columnas esenciales
ALTER TABLE "public"."GERSSON_CUPOS_VIP" 
ADD COLUMN "CLIENTE_ID" INTEGER,
ADD COLUMN "FECHA_CONVERSION_CLIENTE" TIMESTAMP;

-- 2. Crear constraint de foreign key para CLIENTE_ID
ALTER TABLE "public"."GERSSON_CUPOS_VIP" 
ADD CONSTRAINT "fk_vip_cliente" 
FOREIGN KEY ("CLIENTE_ID") 
REFERENCES "public"."GERSSON_CLIENTES"("ID") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- 3. Crear índices básicos
CREATE INDEX "idx_cupos_vip_cliente_id" 
ON "public"."GERSSON_CUPOS_VIP" ("CLIENTE_ID");

CREATE INDEX "idx_cupos_vip_fecha_conversion" 
ON "public"."GERSSON_CUPOS_VIP" ("FECHA_CONVERSION_CLIENTE");

-- 4. Comentarios
COMMENT ON COLUMN "public"."GERSSON_CUPOS_VIP"."CLIENTE_ID" IS 'ID del cliente creado cuando el VIP se convierte';
COMMENT ON COLUMN "public"."GERSSON_CUPOS_VIP"."FECHA_CONVERSION_CLIENTE" IS 'Timestamp cuando el VIP se convirtió en cliente';

-- Verificación
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'GERSSON_CUPOS_VIP' 
AND column_name IN ('CLIENTE_ID', 'FECHA_CONVERSION_CLIENTE');