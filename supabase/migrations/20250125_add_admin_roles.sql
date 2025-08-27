-- Migration: Add admin roles to gersson_admins table
-- Date: 2025-01-25
-- Description: Add role field to distinguish between full admin and supervisor

-- Add rol column to gersson_admins table
ALTER TABLE "public"."gersson_admins" 
ADD COLUMN "rol" VARCHAR(20) NOT NULL DEFAULT 'admin';

-- Create index for faster role-based queries
CREATE INDEX "idx_gersson_admins_rol" 
ON "public"."gersson_admins" ("rol" ASC);

-- Update existing admins to have the 'admin' role by default
UPDATE "public"."gersson_admins" 
SET "rol" = 'admin' 
WHERE "rol" IS NULL OR "rol" = '';

-- Comment on the table to document the roles
COMMENT ON COLUMN "public"."gersson_admins"."rol" IS 'Tipo de rol del administrador: admin (acceso completo) o supervisor (acceso limitado sin reasignacion, configuraciones, webhooks o gestion)';
