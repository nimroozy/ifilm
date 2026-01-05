-- Add cache_directory column to cache_config table
ALTER TABLE cache_config 
ADD COLUMN IF NOT EXISTS cache_directory VARCHAR(500) DEFAULT '/var/cache/nginx';

-- Update existing records with default directory
UPDATE cache_config 
SET cache_directory = '/var/cache/nginx' 
WHERE cache_directory IS NULL;

-- Add comment
COMMENT ON COLUMN cache_config.cache_directory IS 'Base directory for cache storage (e.g., /var/cache/nginx, /mnt/cache)';

