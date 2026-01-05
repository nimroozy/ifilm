import { query } from '../config/database';

export interface CacheConfig {
  id: string;
  cache_type: 'images' | 'videos' | 'all';
  max_size: string;
  inactive_time: string;
  cache_valid_200: string;
  cache_valid_404: string;
  cache_directory: string;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export const getCacheConfig = async (cacheType?: 'images' | 'videos' | 'all'): Promise<CacheConfig[]> => {
  if (cacheType) {
    const result = await query(
      'SELECT * FROM cache_config WHERE cache_type = $1 ORDER BY cache_type',
      [cacheType]
    );
    return result.rows;
  }
  
  const result = await query(
    'SELECT * FROM cache_config ORDER BY cache_type',
    []
  );
  return result.rows;
};

export const getCacheConfigByType = async (cacheType: 'images' | 'videos' | 'all'): Promise<CacheConfig | null> => {
  const result = await query(
    'SELECT * FROM cache_config WHERE cache_type = $1 LIMIT 1',
    [cacheType]
  );
  return result.rows[0] || null;
};

export const saveCacheConfig = async (
  cacheType: 'images' | 'videos' | 'all',
  maxSize: string,
  inactiveTime: string,
  cacheValid200: string,
  cacheValid404: string,
  cacheDirectory: string,
  isEnabled: boolean
): Promise<CacheConfig> => {
  const result = await query(
    `INSERT INTO cache_config (cache_type, max_size, inactive_time, cache_valid_200, cache_valid_404, cache_directory, is_enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
     ON CONFLICT (cache_type) 
     DO UPDATE SET 
       max_size = EXCLUDED.max_size,
       inactive_time = EXCLUDED.inactive_time,
       cache_valid_200 = EXCLUDED.cache_valid_200,
       cache_valid_404 = EXCLUDED.cache_valid_404,
       cache_directory = EXCLUDED.cache_directory,
       is_enabled = EXCLUDED.is_enabled,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [cacheType, maxSize, inactiveTime, cacheValid200, cacheValid404, cacheDirectory || '/var/cache/nginx', isEnabled]
  );
  return result.rows[0];
};

export const updateCacheConfigEnabled = async (
  cacheType: 'images' | 'videos' | 'all',
  isEnabled: boolean
): Promise<CacheConfig> => {
  const result = await query(
    `UPDATE cache_config 
     SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP
     WHERE cache_type = $2
     RETURNING *`,
    [isEnabled, cacheType]
  );
  return result.rows[0];
};

