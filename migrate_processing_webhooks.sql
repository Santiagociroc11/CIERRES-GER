-- Migración: Webhooks en processing sin teléfono → success con error_message
-- Fecha: 2025-08-28

-- Ver cuántos webhooks están en processing sin teléfono
SELECT 
    COUNT(*) as total_processing_sin_telefono,
    flujo,
    COUNT(*) as count_por_flujo
FROM webhook_logs 
WHERE status = 'processing' 
  AND (buyer_phone IS NULL OR buyer_phone = '')
GROUP BY flujo
ORDER BY count_por_flujo DESC;

-- Ver detalles de los que se van a migrar
SELECT 
    id,
    event_type,
    flujo,
    buyer_name,
    buyer_phone,
    received_at,
    processing_time_ms
FROM webhook_logs 
WHERE status = 'processing' 
  AND (buyer_phone IS NULL OR buyer_phone = '')
ORDER BY received_at DESC
LIMIT 20;

-- MIGRACIÓN: Actualizar webhooks en processing sin teléfono
UPDATE webhook_logs 
SET 
    status = 'success',
    error_message = 'Sin número de teléfono disponible',
    processed_at = NOW(),
    processing_time_ms = COALESCE(processing_time_ms, 0)
WHERE status = 'processing' 
  AND (buyer_phone IS NULL OR buyer_phone = '');

-- Verificar resultado
SELECT 
    COUNT(*) as total_migrados
FROM webhook_logs 
WHERE error_message = 'Sin número de teléfono disponible'
  AND status = 'success';

-- Ver distribución final de estados
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM webhook_logs), 2) as percentage
FROM webhook_logs 
GROUP BY status
ORDER BY count DESC;
