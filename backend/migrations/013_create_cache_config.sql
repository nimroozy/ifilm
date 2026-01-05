-- Create cache_config table for NGINX cache settings
CREATE TABLE IF NOT EXISTS cache_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_type VARCHAR(50) NOT NULL CHECK (cache_type IN ('images', 'videos', 'all')),
    max_size VARCHAR(50) NOT NULL DEFAULT '10g', -- e.g., '10g', '50g', '100g'
    inactive_time VARCHAR(50) NOT NULL DEFAULT '7d', -- e.g., '7d', '30d', '90d'
    cache_valid_200 VARCHAR(50) DEFAULT '7d', -- Cache valid time for 200 responses
    cache_valid_404 VARCHAR(50) DEFAULT '1h', -- Cache valid time for 404 responses
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cache_type)
);

-- Insert default cache configs
INSERT INTO cache_config (cache_type, max_size, inactive_time, cache_valid_200, cache_valid_404, is_enabled)
VALUES 
    ('images', '5g', '30d', '30d', '1h', true),
    ('videos', '50g', '7d', '7d', '1h', true),
    ('all', '100g', '7d', '7d', '1h', true)
ON CONFLICT (cache_type) DO NOTHING;

-- Create index
CREATE INDEX idx_cache_config_type ON cache_config(cache_type);
CREATE INDEX idx_cache_config_enabled ON cache_config(is_enabled);

