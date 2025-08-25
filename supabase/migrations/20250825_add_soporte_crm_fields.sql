-- Migration: Add CRM support fields to GERSSON_CLIENTES table
-- Date: 2025-08-25
-- Description: Add fields to store CRM segmentation data from support forms

-- Add CRM support fields to GERSSON_CLIENTES table
ALTER TABLE "public"."GERSSON_CLIENTES" 
ADD COLUMN soporte_tipo VARCHAR(50),
ADD COLUMN soporte_prioridad VARCHAR(20),
ADD COLUMN soporte_duda VARCHAR(50),
ADD COLUMN soporte_descripcion TEXT,
ADD COLUMN soporte_fecha_ultimo BIGINT;

-- Add comments for documentation
COMMENT ON COLUMN "public"."GERSSON_CLIENTES".soporte_tipo IS 'Tipo de segmentación CRM: VIP_POST_VENTA, PROSPECTO_CALIENTE, PROSPECTO_FRIO';
COMMENT ON COLUMN "public"."GERSSON_CLIENTES".soporte_prioridad IS 'Prioridad del cliente de soporte: ALTA, MEDIA, BAJA';
COMMENT ON COLUMN "public"."GERSSON_CLIENTES".soporte_duda IS 'Tipo de duda principal: precio, tecnico, adecuacion, contenido, otra';
COMMENT ON COLUMN "public"."GERSSON_CLIENTES".soporte_descripcion IS 'Descripción CRM generada: Cliente VIP - Post-venta, Lead Caliente - Objeción de Precio, etc.';
COMMENT ON COLUMN "public"."GERSSON_CLIENTES".soporte_fecha_ultimo IS 'Timestamp del último contacto por soporte (formato Unix timestamp)';

-- Create index for better performance when filtering by support data
CREATE INDEX IF NOT EXISTS idx_gersson_clientes_soporte_prioridad ON "public"."GERSSON_CLIENTES"(soporte_prioridad);
CREATE INDEX IF NOT EXISTS idx_gersson_clientes_soporte_tipo ON "public"."GERSSON_CLIENTES"(soporte_tipo);