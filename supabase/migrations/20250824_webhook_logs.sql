-- Tabla para registrar todos los webhooks recibidos
CREATE TABLE IF NOT EXISTS webhook_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    flujo VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'received', -- received, processing, success, error
    
    -- Datos del webhook
    buyer_name VARCHAR(255),
    buyer_email VARCHAR(255),
    buyer_phone VARCHAR(50),
    buyer_country VARCHAR(100),
    
    -- Datos del producto/transacción
    product_name TEXT,
    transaction_id VARCHAR(255),
    purchase_amount DECIMAL(10,2),
    purchase_date TIMESTAMP,
    
    -- Datos del procesamiento
    cliente_id INTEGER,
    asesor_id INTEGER,
    asesor_nombre VARCHAR(255),
    
    -- Procesamiento de integraciones
    manychat_status VARCHAR(20), -- success, error, skipped
    manychat_flow_id VARCHAR(255),
    manychat_subscriber_id VARCHAR(255),
    manychat_error TEXT,
    
    flodesk_status VARCHAR(20), -- success, error, skipped
    flodesk_segment_id VARCHAR(255),
    flodesk_error TEXT,
    
    telegram_status VARCHAR(20), -- success, error, skipped
    telegram_chat_id VARCHAR(255),
    telegram_message_id VARCHAR(255),
    telegram_error TEXT,
    
    -- Metadatos
    raw_webhook_data JSONB, -- El webhook completo recibido
    processing_time_ms INTEGER,
    error_message TEXT,
    error_stack TEXT,
    
    -- Timestamps
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_flujo ON webhook_logs(flujo);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at ON webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_buyer_phone ON webhook_logs(buyer_phone);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_buyer_email ON webhook_logs(buyer_email);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_cliente_id ON webhook_logs(cliente_id);

-- Índice compuesto para consultas de dashboard
CREATE INDEX IF NOT EXISTS idx_webhook_logs_dashboard ON webhook_logs(received_at DESC, status, flujo);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_webhook_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_webhook_logs_updated_at ON webhook_logs;
CREATE TRIGGER trigger_webhook_logs_updated_at
    BEFORE UPDATE ON webhook_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_logs_updated_at();

-- Vista para estadísticas rápidas
CREATE OR REPLACE VIEW webhook_stats AS
SELECT 
    DATE(received_at) as date,
    flujo,
    status,
    COUNT(*) as count,
    AVG(processing_time_ms) as avg_processing_time_ms,
    COUNT(*) FILTER (WHERE manychat_status = 'success') as manychat_success,
    COUNT(*) FILTER (WHERE manychat_status = 'error') as manychat_errors,
    COUNT(*) FILTER (WHERE flodesk_status = 'success') as flodesk_success, 
    COUNT(*) FILTER (WHERE flodesk_status = 'error') as flodesk_errors,
    COUNT(*) FILTER (WHERE telegram_status = 'success') as telegram_success,
    COUNT(*) FILTER (WHERE telegram_status = 'error') as telegram_errors
FROM webhook_logs 
WHERE received_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(received_at), flujo, status
ORDER BY date DESC, flujo;

-- Vista para logs recientes con detalles esenciales
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
    processed_at
FROM webhook_logs 
ORDER BY received_at DESC
LIMIT 1000;