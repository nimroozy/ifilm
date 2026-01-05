import { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { jellyfinService } from '../services/jellyfin.service';
import { clearJellyfinCache } from '../services/jellyfin.service';
import { saveJellyfinConfig as saveConfigToDb } from '../services/jellyfin-config.service';
import { syncLibraries, getLibraries, updateLibraryVisibility as updateLibraryVisibilityService } from '../services/jellyfin-libraries.service';
import { logAction } from '../services/admin-actions.service';
import { query } from '../config/database';
import { saveR2Config, getR2Config as getR2ConfigService } from '../services/r2-config.service';
import { r2Service } from '../services/r2.service';
import { getCacheConfig, getCacheConfigByType, saveCacheConfig, updateCacheConfigEnabled } from '../services/cache-config.service';
import multer from 'multer';

const execAsync = promisify(exec);

export const testJellyfinConnection = async (req: Request, res: Response) => {
  try {
    const { serverUrl, apiKey } = req.body;

    if (!serverUrl || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Server URL and API Key are required',
      });
    }

    // Initialize Jellyfin service with provided credentials
    jellyfinService.initialize(serverUrl, apiKey);

    // Test connection
    const systemInfo = await jellyfinService.testConnection();

    res.json({
      success: true,
      message: 'Successfully connected to Jellyfin server',
      serverInfo: {
        name: systemInfo.ServerName || 'Jellyfin Server',
        version: systemInfo.Version || 'Unknown',
      },
    });
  } catch (error: any) {
    console.error('Jellyfin connection test error:', error);
    
    let message = 'Failed to connect to Jellyfin server';
    if (error.message?.includes('timeout')) {
      message = 'Connection timeout. Please check the server URL.';
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      message = 'Invalid API key. Please check your Jellyfin API key.';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      message = 'Cannot reach Jellyfin server. Please check the server URL.';
    }

    res.status(500).json({
      success: false,
      message,
      detailedError: error.message,
    });
  }
};

export const getSystemStats = async (req: Request, res: Response) => {
  try {
    // Get user count
    const userCountResult = await query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
    const totalUsers = parseInt(userCountResult.rows[0].count) || 0;

    // Get movie count from Jellyfin if configured
    let totalMovies = 0;
    let totalSeries = 0;
    let jellyfinStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    
    if (jellyfinService.isInitialized()) {
      try {
        const moviesResult = await jellyfinService.getItems({ includeItemTypes: 'Movie', limit: 1 });
        totalMovies = moviesResult.TotalRecordCount || 0;
        
        const seriesResult = await jellyfinService.getItems({ includeItemTypes: 'Series', limit: 1 });
        totalSeries = seriesResult.TotalRecordCount || 0;
        
        jellyfinStatus = 'connected';
      } catch (error) {
        console.error('Error fetching Jellyfin stats:', error);
        jellyfinStatus = 'error';
      }
    }

    // Get active streams (placeholder - would need stream tracking)
    const activeStreams = 0;

    // Storage info (placeholder - would need actual storage calculation)
    const storageUsed = '0 GB';
    const storageTotal = '0 GB';

    // API response time (placeholder)
    const apiResponseTime = 0;

    res.json({
      totalUsers,
      totalMovies,
      totalSeries,
      activeStreams,
      storageUsed,
      storageTotal,
      jellyfinStatus,
      apiResponseTime,
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ message: 'Failed to fetch system stats' });
  }
};

export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const { getActionLogs } = await import('../services/admin-actions.service');
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const logs = await getActionLogs(limit, offset);
    
    res.json(logs);
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ message: 'Failed to fetch activity logs' });
  }
};

export const saveJellyfinConfig = async (req: Request, res: Response) => {
  try {
    const { serverUrl, apiKey } = req.body;

    if (!serverUrl || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Server URL and API Key are required',
      });
    }

    // Initialize service first to get server info
    jellyfinService.initialize(serverUrl, apiKey);
    const systemInfo = await jellyfinService.testConnection();

    // Save to database
    const savedConfig = await saveConfigToDb(
      serverUrl,
      apiKey,
      systemInfo.ServerName,
      systemInfo.Version
    );

    // Ensure service is initialized (it should be from testConnection, but double-check)
    if (!jellyfinService.isInitialized()) {
      jellyfinService.initialize(serverUrl, apiKey);
    }

    // Sync libraries to database
    try {
      await syncLibraries(savedConfig.id);
    } catch (syncError) {
      console.error('Error syncing libraries:', syncError);
      // Don't fail the request if library sync fails
    }

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'config_update', savedConfig.id, {
        serverUrl,
        serverName: systemInfo.ServerName,
        version: systemInfo.Version,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'Jellyfin configuration saved successfully',
      serverInfo: {
        name: systemInfo.ServerName || 'Jellyfin Server',
        version: systemInfo.Version || 'Unknown',
      },
    });
  } catch (error: any) {
    console.error('Save Jellyfin config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save Jellyfin configuration',
      detailedError: error.message,
    });
  }
};

export const syncJellyfinLibraries = async (req: Request, res: Response) => {
  try {
    const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
    const config = await loadJellyfinConfig();

    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Jellyfin not configured. Please configure Jellyfin first.',
      });
    }

    // Ensure Jellyfin service is initialized
    if (!jellyfinService.isInitialized()) {
      jellyfinService.initialize(config.serverUrl, config.apiKey);
    }

    const libraries = await syncLibraries(config.id);

    if (libraries.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No libraries found to sync. Make sure Jellyfin has libraries configured.',
        libraries: [],
      });
    }

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'library_sync', config.id, {
        libraryCount: libraries.length,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: `Successfully synced ${libraries.length} librar${libraries.length === 1 ? 'y' : 'ies'}`,
      libraries,
    });
  } catch (error: any) {
    console.error('Sync libraries error:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    
    // Provide more specific error messages
    let userMessage = 'Failed to sync libraries';
    if (errorMessage.includes('Jellyfin client not initialized')) {
      userMessage = 'Jellyfin service not initialized. Please check your Jellyfin configuration.';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      userMessage = 'Cannot connect to Jellyfin server. Please check the server URL.';
    } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
      userMessage = 'Invalid Jellyfin API key. Please check your API key.';
    }
    
    res.status(500).json({
      success: false,
      message: userMessage,
      detailedError: errorMessage,
    });
  }
};

export const getJellyfinLibraries = async (req: Request, res: Response) => {
  try {
    const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
    const config = await loadJellyfinConfig();

    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Jellyfin not configured',
      });
    }

    const libraries = await getLibraries(config.id);

    res.json({
      success: true,
      libraries,
    });
  } catch (error: any) {
    console.error('Get libraries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch libraries',
      detailedError: error.message,
    });
  }
};

export const updateLibraryVisibility = async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    const { isVisible } = req.body;

    if (typeof isVisible !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isVisible must be a boolean',
      });
    }

    const updated = await updateLibraryVisibilityService(libraryId, isVisible);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Library not found',
      });
    }

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'library_visibility', libraryId, {
        isVisible,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'Library visibility updated successfully',
    });
  } catch (error: any) {
    console.error('Update library visibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update library visibility',
      detailedError: error.message,
    });
  }
};

// R2 Configuration Controllers
export const getR2ConfigController = async (req: Request, res: Response) => {
  try {
    const config = await getR2ConfigService();
    
    if (!config) {
      return res.json({
        success: true,
        config: null,
        message: 'R2 not configured',
      });
    }

    // Don't send the secret key in response
    const { secretAccessKey, ...safeConfig } = config;

    res.json({
      success: true,
      config: safeConfig,
    });
  } catch (error: any) {
    console.error('Get R2 config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch R2 configuration',
      detailedError: error.message,
    });
  }
};

export const saveR2ConfigController = async (req: Request, res: Response) => {
  try {
    const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl, endpointUrl, region } = req.body;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return res.status(400).json({
        success: false,
        message: 'Account ID, Access Key ID, Secret Access Key, and Bucket Name are required',
      });
    }

    const savedConfig = await saveR2Config(
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl,
      endpointUrl,
      region
    );

    // Initialize R2 service
    await r2Service.initialize();

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'r2_config_update', savedConfig.id.toString(), {
        accountId,
        bucketName,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    const { secretAccessKey: _, ...safeConfig } = savedConfig;

    res.json({
      success: true,
      message: 'R2 configuration saved successfully',
      config: safeConfig,
    });
  } catch (error: any) {
    console.error('Save R2 config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save R2 configuration',
      detailedError: error.message,
    });
  }
};

export const testR2Connection = async (req: Request, res: Response) => {
  try {
    const { accountId, accessKeyId, secretAccessKey, bucketName, endpointUrl, region } = req.body;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return res.status(400).json({
        success: false,
        message: 'Account ID, Access Key ID, Secret Access Key, and Bucket Name are required',
      });
    }

    // Temporarily initialize R2 service with provided credentials
    const S3Client = (await import('@aws-sdk/client-s3')).S3Client;
    const ListObjectsV2Command = (await import('@aws-sdk/client-s3')).ListObjectsV2Command;
    
    const testClient = new S3Client({
      region: region || 'auto',
      endpoint: endpointUrl || `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });

    // Test by listing objects (limit to 1)
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1,
    });

    await testClient.send(command);

    res.json({
      success: true,
      message: 'Successfully connected to R2 bucket',
    });
  } catch (error: any) {
    console.error('R2 connection test error:', error);
    
    let message = 'Failed to connect to R2 bucket';
    if (error.name === 'NoSuchBucket') {
      message = 'Bucket not found. Please check the bucket name.';
    } else if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
      message = 'Invalid credentials. Please check your Access Key ID and Secret Access Key.';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      message = 'Cannot reach R2 endpoint. Please check the endpoint URL.';
    }

    res.status(500).json({
      success: false,
      message,
      detailedError: error.message,
    });
  }
};

// R2 File Management Controllers
export const listR2Files = async (req: Request, res: Response) => {
  try {
    if (!r2Service.isInitialized()) {
      const initialized = await r2Service.initialize();
      if (!initialized) {
        return res.status(400).json({
          success: false,
          message: 'R2 not configured. Please configure R2 first.',
        });
      }
    }

    const prefix = (req.query.prefix as string) || '';
    const maxKeys = parseInt(req.query.maxKeys as string) || 1000;
    const continuationToken = req.query.continuationToken as string | undefined;

    const result = await r2Service.listFiles(prefix, maxKeys, continuationToken);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('List R2 files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list files',
      detailedError: error.message,
    });
  }
};

export const uploadR2File = async (req: Request, res: Response) => {
  try {
    if (!r2Service.isInitialized()) {
      const initialized = await r2Service.initialize();
      if (!initialized) {
        return res.status(400).json({
          success: false,
          message: 'R2 not configured. Please configure R2 first.',
        });
      }
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const key = req.body.key || file.originalname;
    const contentType = file.mimetype;

    await r2Service.uploadFile(key, file.buffer, contentType);

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'r2_upload', key, {
        key,
        size: file.size,
        contentType,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      key,
    });
  } catch (error: any) {
    console.error('Upload R2 file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      detailedError: error.message,
    });
  }
};

export const downloadR2File = async (req: Request, res: Response) => {
  try {
    if (!r2Service.isInitialized()) {
      const initialized = await r2Service.initialize();
      if (!initialized) {
        return res.status(400).json({
          success: false,
          message: 'R2 not configured. Please configure R2 first.',
        });
      }
    }

    // Extract key from regex route (req.params[0] contains the matched group)
    const key = decodeURIComponent(req.params[0] || req.path.replace('/api/admin/r2/files/', ''));
    const { url } = req.query;

    if (url === 'true') {
      // Return signed URL instead of downloading
      const downloadUrl = await r2Service.getDownloadUrl(key);
      return res.json({
        success: true,
        url: downloadUrl,
      });
    }

    // Download file directly
    const fileData = await r2Service.downloadFile(key);
    const fileName = key.split('/').pop() || key;

    res.setHeader('Content-Type', fileData.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileData.size || fileData.body.length);
    res.send(fileData.body);
  } catch (error: any) {
    console.error('Download R2 file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      detailedError: error.message,
    });
  }
};

export const renameR2File = async (req: Request, res: Response) => {
  try {
    if (!r2Service.isInitialized()) {
      const initialized = await r2Service.initialize();
      if (!initialized) {
        return res.status(400).json({
          success: false,
          message: 'R2 not configured. Please configure R2 first.',
        });
      }
    }

    const { oldKey, newKey } = req.body;

    if (!oldKey || !newKey) {
      return res.status(400).json({
        success: false,
        message: 'Old key and new key are required',
      });
    }

    await r2Service.renameFile(oldKey, newKey);

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'r2_rename', oldKey, {
        oldKey,
        newKey,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'File renamed successfully',
    });
  } catch (error: any) {
    console.error('Rename R2 file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rename file',
      detailedError: error.message,
    });
  }
};

export const moveR2File = async (req: Request, res: Response) => {
  try {
    if (!r2Service.isInitialized()) {
      const initialized = await r2Service.initialize();
      if (!initialized) {
        return res.status(400).json({
          success: false,
          message: 'R2 not configured. Please configure R2 first.',
        });
      }
    }

    const { oldKey, newKey } = req.body;

    if (!oldKey || !newKey) {
      return res.status(400).json({
        success: false,
        message: 'Old key and new key are required',
      });
    }

    await r2Service.moveFile(oldKey, newKey);

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'r2_move', oldKey, {
        oldKey,
        newKey,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'File moved successfully',
    });
  } catch (error: any) {
    console.error('Move R2 file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to move file',
      detailedError: error.message,
    });
  }
};

export const deleteR2File = async (req: Request, res: Response) => {
  try {
    if (!r2Service.isInitialized()) {
      const initialized = await r2Service.initialize();
      if (!initialized) {
        return res.status(400).json({
          success: false,
          message: 'R2 not configured. Please configure R2 first.',
        });
      }
    }

    // Extract key from regex route (req.params[0] contains the matched group)
    const key = decodeURIComponent(req.params[0] || req.path.replace('/api/admin/r2/files/', ''));

    await r2Service.deleteFile(key);

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'r2_delete', key, {
        key,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete R2 file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      detailedError: error.message,
    });
  }
};

export const getR2FileInfo = async (req: Request, res: Response) => {
  try {
    if (!r2Service.isInitialized()) {
      const initialized = await r2Service.initialize();
      if (!initialized) {
        return res.status(400).json({
          success: false,
          message: 'R2 not configured. Please configure R2 first.',
        });
      }
    }

    // Extract key from regex route (req.params[0] contains the matched group)
    const key = decodeURIComponent(req.params[0] || req.path.replace('/api/admin/r2/files/info/', ''));
    const fileInfo = await r2Service.getFileInfo(key);

    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    res.json({
      success: true,
      file: fileInfo,
    });
  } catch (error: any) {
    console.error('Get R2 file info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file info',
      detailedError: error.message,
    });
  }
};

// User Management Controllers
export const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        id, 
        email, 
        username, 
        role, 
        created_at,
        (SELECT MAX(created_at) FROM user_sessions WHERE user_id = users.id) as last_login
      FROM users 
      WHERE is_active = true
      ORDER BY created_at DESC`
    );

    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      username: row.username,
      role: row.role,
      createdAt: row.created_at,
      lastLogin: row.last_login || row.created_at,
    }));

    res.json({
      success: true,
      users,
    });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      detailedError: error.message,
    });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "user" or "admin"',
      });
    }

    // Prevent changing own role
    const adminId = (req as any).user?.userId;
    if (adminId === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role',
      });
    }

    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 AND is_active = true RETURNING id, email, username, role',
      [role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Log admin action
    if (adminId) {
      logAction(adminId, 'user_update', userId, {
        role,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      detailedError: error.message,
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Prevent deleting own account
    const adminId = (req as any).user?.userId;
    if (adminId === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    // Soft delete - set is_active to false
    const result = await query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, email, username',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Log admin action
    if (adminId) {
      logAction(adminId, 'user_delete', userId, {
        email: result.rows[0].email,
        username: result.rows[0].username,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      detailedError: error.message,
    });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, username, password, role } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, username, and password are required',
      });
    }

    // Validate role
    const userRole = role && ['user', 'admin'].includes(role) ? role : 'user';

    // Check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists',
      });
    }

    // Hash password
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.default.hash(password, 10);

    // Create user
    const result = await query(
      'INSERT INTO users (email, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username, role, created_at',
      [email, username, passwordHash, userRole]
    );

    const user = result.rows[0];

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'user_create', user.id, {
        email: user.email,
        username: user.username,
        role: user.role,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.created_at,
        lastLogin: user.created_at,
      },
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      detailedError: error.message,
    });
  }
};

export const clearCache = async (req: Request, res: Response) => {
  try {
    const { cacheType } = req.body; // 'jellyfin', 'nginx', or 'all'
    const adminId = (req as any).user?.userId;
    const results: { [key: string]: { success: boolean; message: string } } = {};

    // Clear Jellyfin cache
    if (cacheType === 'jellyfin' || cacheType === 'all') {
      try {
        clearJellyfinCache();
        results.jellyfin = { success: true, message: 'Jellyfin cache cleared successfully' };
        console.log('[clearCache] Jellyfin cache cleared');
      } catch (error: any) {
        console.error('[clearCache] Error clearing Jellyfin cache:', error);
        results.jellyfin = { success: false, message: `Failed to clear Jellyfin cache: ${error.message}` };
      }
    }

    // Clear Nginx cache
    if (cacheType === 'nginx' || cacheType === 'all') {
      try {
        // Common Nginx cache directories
        const nginxCachePaths = [
          '/var/cache/nginx',
          '/var/lib/nginx/cache',
          '/usr/share/nginx/cache',
        ];

        let nginxCleared = false;
        for (const cachePath of nginxCachePaths) {
          try {
            // Try to clear the cache directory
            await execAsync(`sudo rm -rf ${cachePath}/* 2>/dev/null || true`);
            // Reload Nginx to apply changes
            await execAsync('sudo systemctl reload nginx 2>/dev/null || sudo service nginx reload 2>/dev/null || true');
            nginxCleared = true;
            console.log(`[clearCache] Nginx cache cleared from ${cachePath}`);
            break;
          } catch (pathError) {
            // Try next path
            continue;
          }
        }

        if (nginxCleared) {
          results.nginx = { success: true, message: 'Nginx cache cleared successfully' };
        } else {
          // If we can't clear via file system, try to reload nginx
          try {
            await execAsync('sudo systemctl reload nginx 2>/dev/null || sudo service nginx reload 2>/dev/null || true');
            results.nginx = { success: true, message: 'Nginx reloaded (cache may require manual clearing)' };
          } catch (reloadError) {
            results.nginx = { success: false, message: 'Nginx cache directory not found or insufficient permissions' };
          }
        }
      } catch (error: any) {
        console.error('[clearCache] Error clearing Nginx cache:', error);
        results.nginx = { success: false, message: `Failed to clear Nginx cache: ${error.message}` };
      }
    }

    // Log admin action
    if (adminId) {
      logAction(adminId, 'cache_clear', undefined, {
        cacheType: cacheType || 'all',
        results,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    const allSuccess = Object.values(results).every(r => r.success);
    const allFailed = Object.values(results).every(r => !r.success);

    res.json({
      success: allSuccess,
      message: allSuccess
        ? 'All caches cleared successfully'
        : allFailed
        ? 'Failed to clear caches'
        : 'Cache clearing completed with some errors',
      results,
    });
  } catch (error: any) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      detailedError: error.message,
    });
  }
};

// Cache configuration endpoints
export const getCacheConfigController = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const cacheType = type as 'images' | 'videos' | 'all' | undefined;
    
    const configs = await getCacheConfig(cacheType);
    
    res.json({
      success: true,
      configs,
    });
  } catch (error: any) {
    console.error('Get cache config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cache configuration',
      detailedError: error.message,
    });
  }
};

export const saveCacheConfigController = async (req: Request, res: Response) => {
  try {
    const { cacheType, maxSize, inactiveTime, cacheValid200, cacheValid404, cacheDirectory, isEnabled } = req.body;

    if (!cacheType || !maxSize || !inactiveTime) {
      return res.status(400).json({
        success: false,
        message: 'Cache type, max size, and inactive time are required',
      });
    }

    if (!['images', 'videos', 'all'].includes(cacheType)) {
      return res.status(400).json({
        success: false,
        message: 'Cache type must be one of: images, videos, all',
      });
    }

    const savedConfig = await saveCacheConfig(
      cacheType,
      maxSize,
      inactiveTime,
      cacheValid200 || '7d',
      cacheValid404 || '1h',
      cacheDirectory || '/var/cache/nginx',
      isEnabled !== undefined ? isEnabled : true
    );

    // Update NGINX cache config automatically
    try {
      await execAsync('cd /opt/ifilm && sudo /opt/ifilm/backend/scripts/update-nginx-cache.sh 2>&1');
      console.log('[saveCacheConfig] NGINX cache config updated successfully');
    } catch (nginxError: any) {
      console.warn('[saveCacheConfig] Failed to update NGINX cache config:', nginxError.message);
      // Don't fail the request, just log the warning
    }

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'cache_config_update', savedConfig.id, {
        cacheType,
        maxSize,
        inactiveTime,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'Cache configuration saved successfully',
      config: savedConfig,
    });
  } catch (error: any) {
    console.error('Save cache config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save cache configuration',
      detailedError: error.message,
    });
  }
};

export const updateCacheConfigEnabledController = async (req: Request, res: Response) => {
  try {
    const { cacheType } = req.params;
    const { isEnabled } = req.body;

    if (!['images', 'videos', 'all'].includes(cacheType)) {
      return res.status(400).json({
        success: false,
        message: 'Cache type must be one of: images, videos, all',
      });
    }

    const updatedConfig = await updateCacheConfigEnabled(
      cacheType as 'images' | 'videos' | 'all',
      isEnabled
    );

    // Update NGINX cache config automatically
    try {
      await execAsync('cd /opt/ifilm && sudo /opt/ifilm/backend/scripts/update-nginx-cache.sh 2>&1');
      console.log('[updateCacheConfigEnabled] NGINX cache config updated successfully');
    } catch (nginxError: any) {
      console.warn('[updateCacheConfigEnabled] Failed to update NGINX cache config:', nginxError.message);
      // Don't fail the request, just log the warning
    }

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'cache_config_toggle', updatedConfig.id, {
        cacheType,
        isEnabled,
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'Cache configuration updated successfully',
      config: updatedConfig,
    });
  } catch (error: any) {
    console.error('Update cache config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cache configuration',
      detailedError: error.message,
    });
  }
};

export const reloadNginxConfigController = async (req: Request, res: Response) => {
  try {
    // Test NGINX config first
    let testOutput = '';
    let testError = '';
    let testExitCode = 0;
    
    try {
      const testResult = await execAsync('sudo nginx -t 2>&1');
      testOutput = testResult.stdout || '';
      testError = testResult.stderr || '';
      // Check if test was successful - nginx -t outputs "test is successful" on success
      if (!testOutput.includes('test is successful') && !testOutput.includes('syntax is ok')) {
        return res.status(400).json({
          success: false,
          message: 'NGINX configuration test failed',
          error: testError || testOutput,
          output: testOutput,
        });
      }
    } catch (error: any) {
      // execAsync throws on non-zero exit code
      const errorMessage = error.stderr || error.stdout || error.message;
      return res.status(400).json({
        success: false,
        message: 'NGINX configuration test failed',
        error: errorMessage,
        hint: 'Please run "sudo nginx -t" manually to see the error',
      });
    }

    // Reload NGINX
    let reloadOutput = '';
    try {
      const reloadResult = await execAsync('sudo systemctl reload nginx 2>&1');
      reloadOutput = reloadResult.stdout || '';
    } catch (error: any) {
      const errorMessage = error.stderr || error.stdout || error.message;
      return res.status(500).json({
        success: false,
        message: 'Failed to reload NGINX',
        error: errorMessage,
        hint: 'The backend may not have sudo permissions. Please run "sudo systemctl reload nginx" manually or configure sudoers.',
      });
    }

    // Log admin action
    const adminId = (req as any).user?.userId;
    if (adminId) {
      logAction(adminId, 'nginx_reload', undefined, {
        message: 'NGINX configuration reloaded',
      }).catch((err: any) => console.error('Failed to log admin action:', err));
    }

    res.json({
      success: true,
      message: 'NGINX configuration reloaded successfully',
      testOutput,
      reloadOutput,
    });
  } catch (error: any) {
    console.error('Reload NGINX error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reload NGINX',
      detailedError: error.message,
      hint: 'The backend may not have sudo permissions. Please run the update script manually: sudo /opt/ifilm/backend/scripts/update-nginx-cache.sh && sudo systemctl reload nginx',
    });
  }
};

export const getCacheStatusController = async (req: Request, res: Response) => {
  try {
    const configs = await getCacheConfig();
    const status: any[] = [];
    
    for (const config of configs) {
      if (!config.is_enabled) {
        status.push({
          cacheType: config.cache_type,
          enabled: false,
          directory: config.cache_directory || '/var/cache/nginx',
          message: 'Cache is disabled',
        });
        continue;
      }
      
      const cacheDir = `${config.cache_directory || '/var/cache/nginx'}/${config.cache_type}`;
      
      try {
        // Check if directory exists
        const { stdout: dirCheck } = await execAsync(`test -d "${cacheDir}" && echo "exists" || echo "missing"`);
        const exists = dirCheck.trim() === 'exists';
        
        if (!exists) {
          status.push({
            cacheType: config.cache_type,
            enabled: true,
            directory: cacheDir,
            exists: false,
            message: 'Cache directory does not exist',
          });
          continue;
        }
        
        // Get directory size
        let size = '0';
        let fileCount = '0';
        try {
          const { stdout: duOutput } = await execAsync(`du -sh "${cacheDir}" 2>/dev/null | cut -f1`);
          size = duOutput.trim() || '0';
          
          const { stdout: countOutput } = await execAsync(`find "${cacheDir}" -type f 2>/dev/null | wc -l`);
          fileCount = countOutput.trim() || '0';
        } catch (e) {
          // Ignore errors
        }
        
        // Check NGINX cache zone status
        let nginxStatus = 'unknown';
        try {
          const { stdout: nginxTest } = await execAsync('sudo nginx -T 2>/dev/null | grep -A 5 "proxy_cache_path.*' + config.cache_type + '" || echo ""');
          nginxStatus = nginxTest.trim() ? 'configured' : 'not_configured';
        } catch (e) {
          nginxStatus = 'error';
        }
        
        status.push({
          cacheType: config.cache_type,
          enabled: true,
          directory: cacheDir,
          exists: true,
          size,
          fileCount: parseInt(fileCount),
          maxSize: config.max_size,
          inactiveTime: config.inactive_time,
          nginxStatus,
          config: {
            maxSize: config.max_size,
            inactiveTime: config.inactive_time,
            cacheValid200: config.cache_valid_200,
            cacheValid404: config.cache_valid_404,
          },
        });
      } catch (error: any) {
        status.push({
          cacheType: config.cache_type,
          enabled: true,
          directory: cacheDir,
          error: error.message,
          message: 'Failed to check cache status',
        });
      }
    }
    
    res.json({
      success: true,
      status,
    });
  } catch (error: any) {
    console.error('Get cache status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cache status',
      detailedError: error.message,
    });
  }
};
