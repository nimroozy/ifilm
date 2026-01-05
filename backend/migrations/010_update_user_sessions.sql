-- Update user_sessions table to ensure ip_address and user_agent fields exist
DO $$
BEGIN
    -- Add ip_address if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_sessions' AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN ip_address VARCHAR(45);
    END IF;

    -- Add user_agent if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_sessions' AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN user_agent TEXT;
    END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_sessions_ip_address ON user_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_sessions_user_agent ON user_sessions(user_agent);

