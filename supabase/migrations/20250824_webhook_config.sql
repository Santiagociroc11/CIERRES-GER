-- Migration: Create webhook configuration table
-- Date: 2025-08-24
-- Description: Store webhook configuration in database instead of JSON files

-- Create webhook_config table
CREATE TABLE IF NOT EXISTS webhook_config (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL, -- 'hotmart', 'stripe', 'paypal', etc.
    config_key VARCHAR(100) NOT NULL, -- 'numericos', 'flodesk', 'tokens', 'telegram'
    config_value JSONB NOT NULL, -- Store the actual configuration as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system',
    is_active BOOLEAN DEFAULT true,
    
    -- Ensure unique combinations
    UNIQUE(platform, config_key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_config_platform_key ON webhook_config(platform, config_key);
CREATE INDEX IF NOT EXISTS idx_webhook_config_active ON webhook_config(is_active);

-- Insert initial configuration for Hotmart
INSERT INTO webhook_config (platform, config_key, config_value, created_by) VALUES
-- ManyChat Flow IDs
('hotmart', 'numericos', '{
    "CARRITOS": "content20250222080111_909145",
    "RECHAZADOS": "content20250222082908_074257", 
    "COMPRAS": "content20250222083048_931507",
    "TICKETS": "content20250222083004_157122"
}', 'migration'),

-- Flodesk Segment IDs
('hotmart', 'flodesk', '{
    "CARRITOS": "112554445482493399",
    "RECHAZADOS": "112554438393071296",
    "COMPRAS": "112554427903116632", 
    "TICKETS": "147071027455723326"
}', 'migration'),

-- API Tokens (empty by default for security)
('hotmart', 'tokens', '{
    "manychat": "",
    "flodesk": "",
    "telegram": ""
}', 'migration'),

-- Telegram Configuration
('hotmart', 'telegram', '{
    "groupChatId": "-1002176532359",
    "threadId": "807"
}', 'migration')

ON CONFLICT (platform, config_key) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_webhook_config_updated_at
    BEFORE UPDATE ON webhook_config
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_config_updated_at();

-- Create function to get webhook config by platform
CREATE OR REPLACE FUNCTION get_webhook_config(p_platform VARCHAR(50))
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    config_record RECORD;
BEGIN
    FOR config_record IN 
        SELECT config_key, config_value 
        FROM webhook_config 
        WHERE platform = p_platform AND is_active = true
    LOOP
        result := result || jsonb_build_object(config_record.config_key, config_record.config_value);
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to update webhook config
CREATE OR REPLACE FUNCTION update_webhook_config(
    p_platform VARCHAR(50),
    p_config_key VARCHAR(100),
    p_config_value JSONB,
    p_updated_by VARCHAR(100) DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO webhook_config (platform, config_key, config_value, updated_by)
    VALUES (p_platform, p_config_key, p_config_value, p_updated_by)
    ON CONFLICT (platform, config_key) 
    DO UPDATE SET 
        config_value = p_config_value,
        updated_at = NOW(),
        updated_by = p_updated_by;
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Create function to reset webhook config to defaults
CREATE OR REPLACE FUNCTION reset_webhook_config(p_platform VARCHAR(50))
RETURNS BOOLEAN AS $$
BEGIN
    -- Deactivate current config
    UPDATE webhook_config 
    SET is_active = false, updated_at = NOW(), updated_by = 'system'
    WHERE platform = p_platform;
    
    -- Insert default config
    INSERT INTO webhook_config (platform, config_key, config_value, created_by)
    SELECT 
        platform, 
        config_key, 
        config_value, 
        'system'
    FROM webhook_config 
    WHERE platform = p_platform AND created_by = 'migration';
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON webhook_config TO authenticated;
GRANT USAGE ON SEQUENCE webhook_config_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION get_webhook_config(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION update_webhook_config(VARCHAR, VARCHAR, JSONB, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_webhook_config(VARCHAR) TO authenticated;
