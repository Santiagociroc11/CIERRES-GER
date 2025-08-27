-- Migration: Add example supervisor user
-- Date: 2025-01-25
-- Description: Add an example supervisor user to demonstrate the new role system

-- Insert example supervisor user (update whatsapp and nombre as needed)
INSERT INTO "public"."gersson_admins" ("nombre", "whatsapp", "rol") 
VALUES ('Supervisor de Ejemplo', '1234567890', 'supervisor')
ON CONFLICT ("whatsapp") DO UPDATE SET 
  "rol" = EXCLUDED."rol",
  "nombre" = EXCLUDED."nombre";

-- Comment explaining the role system
COMMENT ON TABLE "public"."gersson_admins" IS 'Tabla de administradores con sistema de roles: admin (acceso completo) y supervisor (acceso limitado)';

-- Example of how to update an existing admin to supervisor
-- UPDATE "public"."gersson_admins" 
-- SET "rol" = 'supervisor' 
-- WHERE "whatsapp" = 'numero_del_supervisor';

-- Example of how to update a supervisor back to admin
-- UPDATE "public"."gersson_admins" 
-- SET "rol" = 'admin' 
-- WHERE "whatsapp" = 'numero_del_admin';
