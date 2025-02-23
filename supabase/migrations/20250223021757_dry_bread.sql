/*
  # Update reports table for file storage

  1. Changes
    - Add new columns for storing file URLs directly in the reports table
    - Remove dependency on storage extension
*/

-- Add URL columns to store file locations
ALTER TABLE GERSSON_REPORTES
ADD COLUMN IF NOT EXISTS IMAGEN_CONVERSACION_URL text,
ADD COLUMN IF NOT EXISTS IMAGEN_PAGO_URL text;

-- Update existing records (if any) to use new columns
UPDATE GERSSON_REPORTES
SET IMAGEN_PAGO_URL = IMAGEN_PAGO,
    IMAGEN_CONVERSACION_URL = IMAGEN_CONVERSACION
WHERE IMAGEN_PAGO IS NOT NULL OR IMAGEN_CONVERSACION IS NOT NULL;

-- Drop old columns
ALTER TABLE GERSSON_REPORTES
DROP COLUMN IF EXISTS IMAGEN_PAGO,
DROP COLUMN IF EXISTS IMAGEN_CONVERSACION;