/*
  # Agregar campo COMPLETADO a la tabla de reportes

  1. Cambios
    - Agregar columna COMPLETADO (boolean) a GERSSON_REPORTES
    - Valor por defecto: false
    - No permite nulos

  2. Notas
    - Este campo ayudará a rastrear qué seguimientos han sido completados
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gersson_reportes' AND column_name = 'completado'
  ) THEN
    ALTER TABLE GERSSON_REPORTES
    ADD COLUMN COMPLETADO boolean NOT NULL DEFAULT false;
  END IF;
END $$;