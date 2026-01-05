-- Add unique constraint on (config_id, library_id) to prevent duplicate libraries
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'jellyfin_libraries_config_library_unique'
    ) THEN
        ALTER TABLE jellyfin_libraries 
        ADD CONSTRAINT jellyfin_libraries_config_library_unique 
        UNIQUE (config_id, library_id);
    END IF;
END $$;

