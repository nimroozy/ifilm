import { query } from '../config/database';
import { encrypt, decrypt } from '../utils/encryption.util';

export interface JellyfinConfig {
  id: string;
  serverUrl: string;
  apiKey: string;
  serverName?: string;
  serverVersion?: string;
  isActive: boolean;
}

export const loadJellyfinConfig = async (): Promise<JellyfinConfig | null> => {
  try {
    const result = await query(
      'SELECT id, server_url, api_key_encrypted, server_name, server_version, is_active FROM jellyfin_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const apiKey = decrypt(row.api_key_encrypted);

    return {
      id: row.id,
      serverUrl: row.server_url,
      apiKey,
      serverName: row.server_name,
      serverVersion: row.server_version,
      isActive: row.is_active,
    };
  } catch (error) {
    console.error('Error loading Jellyfin config:', error);
    return null;
  }
};

export const saveJellyfinConfig = async (
  serverUrl: string,
  apiKey: string,
  serverName?: string,
  serverVersion?: string
): Promise<JellyfinConfig> => {
  const encryptedApiKey = encrypt(apiKey);

  // Check if active config exists
  const existing = await query(
    'SELECT id FROM jellyfin_config WHERE is_active = true LIMIT 1'
  );

  if (existing.rows.length > 0) {
    // Update existing config
    const result = await query(
      'UPDATE jellyfin_config SET server_url = $1, api_key_encrypted = $2, server_name = $3, server_version = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id, server_url, server_name, server_version, is_active',
      [serverUrl, encryptedApiKey, serverName || null, serverVersion || null, existing.rows[0].id]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      serverUrl: row.server_url,
      apiKey, // Return unencrypted for service initialization
      serverName: row.server_name,
      serverVersion: row.server_version,
      isActive: row.is_active,
    };
  } else {
    // Insert new config
    const result = await query(
      'INSERT INTO jellyfin_config (server_url, api_key_encrypted, server_name, server_version) VALUES ($1, $2, $3, $4) RETURNING id, server_url, server_name, server_version, is_active',
      [serverUrl, encryptedApiKey, serverName || null, serverVersion || null]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      serverUrl: row.server_url,
      apiKey, // Return unencrypted for service initialization
      serverName: row.server_name,
      serverVersion: row.server_version,
      isActive: row.is_active,
    };
  }
};

