-- Migration: Create R2 Configuration Table
-- Description: Stores Cloudflare R2 storage configuration

CREATE TABLE IF NOT EXISTS r2_config (
  id SERIAL PRIMARY KEY,
  account_id VARCHAR(255) NOT NULL,
  access_key_id VARCHAR(255) NOT NULL,
  secret_access_key TEXT NOT NULL, -- Encrypted
  bucket_name VARCHAR(255) NOT NULL,
  public_url VARCHAR(500),
  endpoint_url VARCHAR(500) NOT NULL DEFAULT 'https://{account_id}.r2.cloudflarestorage.com',
  region VARCHAR(100) DEFAULT 'auto',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active config lookup
CREATE INDEX IF NOT EXISTS idx_r2_config_active ON r2_config(is_active) WHERE is_active = true;

-- Add comment
COMMENT ON TABLE r2_config IS 'Stores Cloudflare R2 storage configuration';
COMMENT ON COLUMN r2_config.secret_access_key IS 'Encrypted secret access key';
COMMENT ON COLUMN r2_config.endpoint_url IS 'R2 endpoint URL (defaults to Cloudflare R2 endpoint)';

