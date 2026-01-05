-- Create watch_history table
CREATE TABLE IF NOT EXISTS watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id VARCHAR(255) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'episode')),
    media_title VARCHAR(500),
    progress INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    percentage DECIMAL(5,2) DEFAULT 0,
    last_watched TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, media_id, media_type)
);

-- Create indexes
CREATE INDEX idx_watch_history_user_media ON watch_history(user_id, media_id);
CREATE INDEX idx_watch_history_last_watched ON watch_history(last_watched DESC);
CREATE INDEX idx_watch_history_media_type ON watch_history(media_type);
CREATE INDEX idx_watch_history_user_id ON watch_history(user_id);