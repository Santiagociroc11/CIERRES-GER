-- Add missing buyer-related fields to webhook_logs table
ALTER TABLE webhook_logs 
ADD COLUMN IF NOT EXISTS buyer_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS buyer_previous_advisor VARCHAR(255),
ADD COLUMN IF NOT EXISTS redirect_reason VARCHAR(100);

-- Add indexes for the new columns for better query performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_buyer_status ON webhook_logs(buyer_status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_redirect_reason ON webhook_logs(redirect_reason);

-- Update the recent_webhook_logs view to include the new fields
DROP VIEW IF EXISTS recent_webhook_logs;
CREATE VIEW recent_webhook_logs AS
SELECT 
    id,
    event_type,
    flujo,
    status,
    buyer_name,
    buyer_email,
    buyer_phone,
    buyer_country,
    buyer_status,
    buyer_previous_advisor,
    product_name,
    transaction_id,
    cliente_id,
    asesor_nombre,
    manychat_status,
    flodesk_status,
    telegram_status,
    processing_time_ms,
    error_message,
    redirect_reason,
    received_at,
    processed_at,
    processing_steps
FROM webhook_logs 
ORDER BY received_at DESC
LIMIT 1000;