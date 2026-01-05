-- Create jellyfin_config table
CREATE TABLE IF NOT EXISTS jellyfin_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_url VARCHAR(500) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    jellyfin_user_id VARCHAR(255),
    server_name VARCHAR(255),
    server_version VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create jellyfin_libraries table
CREATE TABLE IF NOT EXISTS jellyfin_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES jellyfin_config(id) ON DELETE CASCADE,
    library_id VARCHAR(255) NOT NULL,
    library_name VARCHAR(255) NOT NULL,
    collection_type VARCHAR(50) CHECK (collection_type IN ('movies', 'tvshows', 'music', 'mixed')),
    is_visible BOOLEAN DEFAULT true,
    item_count INTEGER DEFAULT 0,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_jellyfin_libraries_config_id ON jellyfin_libraries(config_id);
CREATE INDEX idx_jellyfin_libraries_library_id ON jellyfin_libraries(library_id);
CREATE INDEX idx_jellyfin_libraries_is_visible ON jellyfin_libraries(is_visible);