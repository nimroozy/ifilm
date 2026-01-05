import { query } from '../config/database';
import { encrypt, decrypt } from '../utils/encryption.util';

export interface R2Config {
  id: number;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
  endpointUrl: string;
  region: string;
  isActive: boolean;
}

export const loadR2Config = async (): Promise<R2Config | null> => {
  try {
    const result = await query(
      'SELECT id, account_id, access_key_id, secret_access_key, bucket_name, public_url, endpoint_url, region, is_active FROM r2_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const secretAccessKey = decrypt(row.secret_access_key);

    return {
      id: row.id,
      accountId: row.account_id,
      accessKeyId: row.access_key_id,
      secretAccessKey,
      bucketName: row.bucket_name,
      publicUrl: row.public_url,
      endpointUrl: row.endpoint_url,
      region: row.region,
      isActive: row.is_active,
    };
  } catch (error) {
    console.error('Error loading R2 config:', error);
    return null;
  }
};

export const saveR2Config = async (
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  publicUrl?: string,
  endpointUrl?: string,
  region?: string
): Promise<R2Config> => {
  const encryptedSecret = encrypt(secretAccessKey);
  const finalEndpointUrl = endpointUrl || `https://${accountId}.r2.cloudflarestorage.com`;
  const finalRegion = region || 'auto';

  // Check if active config exists
  const existing = await query(
    'SELECT id FROM r2_config WHERE is_active = true LIMIT 1'
  );

  if (existing.rows.length > 0) {
    // Update existing active config
    await query(
      `UPDATE r2_config 
       SET account_id = $1, access_key_id = $2, secret_access_key = $3, 
           bucket_name = $4, public_url = $5, endpoint_url = $6, region = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [accountId, accessKeyId, encryptedSecret, bucketName, publicUrl || null, finalEndpointUrl, finalRegion, existing.rows[0].id]
    );

    const result = await query(
      'SELECT id, account_id, access_key_id, secret_access_key, bucket_name, public_url, endpoint_url, region, is_active FROM r2_config WHERE id = $1',
      [existing.rows[0].id]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      accountId: row.account_id,
      accessKeyId: row.access_key_id,
      secretAccessKey: decrypt(row.secret_access_key),
      bucketName: row.bucket_name,
      publicUrl: row.public_url,
      endpointUrl: row.endpoint_url,
      region: row.region,
      isActive: row.is_active,
    };
  } else {
    // Create new config
    const result = await query(
      `INSERT INTO r2_config (account_id, access_key_id, secret_access_key, bucket_name, public_url, endpoint_url, region, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id, account_id, access_key_id, secret_access_key, bucket_name, public_url, endpoint_url, region, is_active`,
      [accountId, accessKeyId, encryptedSecret, bucketName, publicUrl || null, finalEndpointUrl, finalRegion]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      accountId: row.account_id,
      accessKeyId: row.access_key_id,
      secretAccessKey: decrypt(row.secret_access_key),
      bucketName: row.bucket_name,
      publicUrl: row.public_url,
      endpointUrl: row.endpoint_url,
      region: row.region,
      isActive: row.is_active,
    };
  }
};

export const getR2Config = async (): Promise<R2Config | null> => {
  return loadR2Config();
};

