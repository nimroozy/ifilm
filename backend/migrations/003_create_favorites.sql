-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id VARCHAR(255) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'series')),
    media_title VARCHAR(500),
    media_poster_url TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, media_id, media_type)
);

-- Create indexes
CREATE INDEX idx_favorites_user_media ON favorites(user_id, media_id);
CREATE INDEX idx_favorites_added_at ON favorites(added_at DESC);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);