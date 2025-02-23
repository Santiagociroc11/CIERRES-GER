/*
  # Add MONTO_COMPRA column to GERSSON_CLIENTES table

  1. Changes
    - Add MONTO_COMPRA column to GERSSON_CLIENTES table
    - Set default value to 0
    - Make column nullable to handle cases where amount is not yet known

  2. Notes
    - Uses numeric type to handle decimal values accurately
    - Safe migration that won't affect existing data
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gersson_clientes' AND column_name = 'monto_compra'
  ) THEN
    ALTER TABLE GERSSON_CLIENTES
    ADD COLUMN MONTO_COMPRA numeric(10,2) DEFAULT 0;
  END IF;
END $$;