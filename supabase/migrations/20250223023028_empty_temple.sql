/*
  # Add currency column to GERSSON_CLIENTES table

  1. Changes
    - Add MONEDA_COMPRA column to GERSSON_CLIENTES table
    - Set default value to 'COP'
    - Add check constraint to ensure only valid currencies

  2. Notes
    - Uses text type with check constraint for currency codes
    - Safe migration that won't affect existing data
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gersson_clientes' AND column_name = 'moneda_compra'
  ) THEN
    ALTER TABLE GERSSON_CLIENTES
    ADD COLUMN MONEDA_COMPRA text DEFAULT 'COP'
    CONSTRAINT valid_currency CHECK (MONEDA_COMPRA IN ('COP', 'USD'));
  END IF;
END $$;