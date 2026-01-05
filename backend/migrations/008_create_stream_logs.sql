-- Create stream_logs table
CREATE TABLE IF NOT EXISTS stream_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    media_id VARCHAR(255) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'episode')),
    stream_token TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    quality VARCHAR(20),
    bandwidth BIGINT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration_watched INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX idx_stream_logs_user_id ON stream_logs(user_id);
CREATE INDEX idx_stream_logs_media_id ON stream_logs(media_id);
CREATE INDEX idx_stream_logs_stream_token ON stream_logs(stream_token);
CREATE INDEX idx_stream_logs_started_at ON stream_logs(started_at DESC);

