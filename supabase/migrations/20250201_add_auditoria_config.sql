-- Migration: Add auditoria config to webhook_config
-- Date: 2025-02-01
-- Description: Insert initial auditoria configuration (claves, 1 vs 2 auditores)

INSERT INTO webhook_config (platform, config_key, config_value, created_by) VALUES
('auditoria', 'config', '{
  "claveAccesoModal": "auditortd2025",
  "claveAccesoPanel": "auditortd2025",
  "requiereDosAuditores": true,
  "auditores": [
    {"clave": "0911", "nombre": "Auditor Principal"},
    {"clave": "092501", "nombre": "Auditor Secundario"}
  ]
}'::jsonb, 'migration')
ON CONFLICT (platform, config_key) DO NOTHING;
