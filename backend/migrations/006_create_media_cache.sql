-- Create media_cache table
CREATE TABLE IF NOT EXISTS media_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id VARCHAR(255) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'series', 'episode')),
    title VARCHAR(500) NOT NULL,
    overview TEXT,
    poster_url TEXT,
    backdrop_url TEXT,
    year INTEGER,
    rating DECIMAL(3,1),
    duration INTEGER,
    genres JSONB,
    metadata JSONB,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(media_id, media_type)
);

-- Create indexes
CREATE INDEX idx_media_cache_media_id ON media_cache(media_id);
CREATE INDEX idx_media_cache_media_type ON media_cache(media_type);
CREATE INDEX idx_media_cache_expires_at ON media_cache(expires_at);

-- Create function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_media_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM media_cache WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

