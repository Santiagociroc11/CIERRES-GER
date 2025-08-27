-- Migración para agregar campo processing_steps a webhook_logs
-- Fecha: 2025-01-15

-- Agregar campo processing_steps para almacenar los pasos detallados del procesamiento
ALTER TABLE webhook_logs 
ADD COLUMN IF NOT EXISTS processing_steps JSONB;

-- Agregar comentario descriptivo
COMMENT ON COLUMN webhook_logs.processing_steps IS 'Pasos detallados del procesamiento del webhook en formato JSON';

-- Crear índice para búsquedas en processing_steps
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processing_steps 
ON webhook_logs USING GIN (processing_steps);

-- Actualizar la vista recent_webhook_logs para incluir el nuevo campo
DROP VIEW IF EXISTS recent_webhook_logs;
CREATE OR REPLACE VIEW recent_webhook_logs AS
SELECT 
    id,
    event_type,
    flujo,
    status,
    buyer_name,
    buyer_email,
    buyer_phone,
    product_name,
    transaction_id,
    cliente_id,
    asesor_nombre,
    manychat_status,
    flodesk_status,
    telegram_status,
    processing_time_ms,
    error_message,
    received_at,
    processed_at,
    processing_steps
FROM webhook_logs 
ORDER BY received_at DESC
LIMIT 1000;

-- Función para buscar logs por pasos específicos
CREATE OR REPLACE FUNCTION search_webhook_logs_by_step(step_name TEXT)
RETURNS TABLE (
    id BIGINT,
    event_type VARCHAR(50),
    flujo VARCHAR(20),
    status VARCHAR(20),
    step_info JSONB,
    received_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wl.id,
        wl.event_type,
        wl.flujo,
        wl.status,
        jsonb_array_elements(wl.processing_steps) AS step_info,
        wl.received_at
    FROM webhook_logs wl
    WHERE wl.processing_steps IS NOT NULL
    AND wl.processing_steps @> jsonb_build_array(jsonb_build_object('step', step_name))
    ORDER BY wl.received_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de pasos de procesamiento
CREATE OR REPLACE FUNCTION get_processing_steps_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
    step_name TEXT,
    total_executions BIGINT,
    success_count BIGINT,
    error_count BIGINT,
    avg_duration_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH step_stats AS (
        SELECT 
            (step->>'step')::TEXT as step_name,
            COUNT(*) as executions,
            COUNT(*) FILTER (WHERE (step->>'status') = 'completed') as success_count,
            COUNT(*) FILTER (WHERE (step->>'status') = 'failed') as error_count
        FROM webhook_logs wl,
             jsonb_array_elements(wl.processing_steps) AS step
        WHERE wl.received_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
        AND wl.processing_steps IS NOT NULL
        GROUP BY (step->>'step')::TEXT
    )
    SELECT 
        ss.step_name,
        ss.executions,
        ss.success_count,
        ss.error_count,
        CASE 
            WHEN ss.executions > 0 THEN 
                (ss.success_count::NUMERIC / ss.executions::NUMERIC) * 100
            ELSE 0 
        END as avg_duration_ms
    FROM step_stats ss
    ORDER BY ss.executions DESC;
END;
$$ LANGUAGE plpgsql;
