import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadR2Config, R2Config } from './r2-config.service';

export interface R2File {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
  contentType?: string;
}

export interface R2ListResponse {
  files: R2File[];
  prefix: string;
  hasMore: boolean;
  nextContinuationToken?: string;
}

class R2Service {
  private client: S3Client | null = null;
  private config: R2Config | null = null;

  async initialize(): Promise<boolean> {
    try {
      const config = await loadR2Config();
      if (!config) {
        return false;
      }

      this.config = config;
      this.client = new S3Client({
        region: config.region,
        endpoint: config.endpointUrl,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: true, // Required for R2
      });

      return true;
    } catch (error) {
      console.error('Error initializing R2 service:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.client !== null && this.config !== null;
  }

  async listFiles(prefix: string = '', maxKeys: number = 1000, continuationToken?: string): Promise<R2ListResponse> {
    if (!this.client || !this.config) {
      throw new Error('R2 service not initialized');
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
        Delimiter: '/',
      });

      const response = await this.client.send(command);

      const files: R2File[] = [];

      // Add directories (CommonPrefixes)
      if (response.CommonPrefixes) {
        for (const commonPrefix of response.CommonPrefixes) {
          if (commonPrefix.Prefix) {
            const prefixPath = commonPrefix.Prefix;
            const name = prefixPath.replace(prefix || '', '').replace('/', '');
            files.push({
              key: prefixPath,
              name,
              size: 0,
              lastModified: new Date(),
              isDirectory: true,
            });
          }
        }
      }

      // Add files
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Key !== prefix) {
            const name = object.Key.replace(prefix || '', '');
            files.push({
              key: object.Key,
              name,
              size: object.Size || 0,
              lastModified: object.LastModified || new Date(),
              isDirectory: false,
              contentType: undefined, // Will be fetched if needed
            });
          }
        }
      }

      return {
        files,
        prefix,
        hasMore: response.IsTruncated || false,
        nextContinuationToken: response.NextContinuationToken,
      };
    } catch (error: any) {
      console.error('Error listing R2 files:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async uploadFile(key: string, file: Buffer, contentType?: string): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('R2 service not initialized');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType || 'application/octet-stream',
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('Error uploading file to R2:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async downloadFile(key: string): Promise<{ body: Buffer; contentType?: string; size?: number }> {
    if (!this.client || !this.config) {
      throw new Error('R2 service not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      const chunks: Uint8Array[] = [];

      if (response.Body) {
        for await (const chunk of response.Body as any) {
          chunks.push(chunk);
        }
      }

      const buffer = Buffer.concat(chunks);

      return {
        body: buffer,
        contentType: response.ContentType,
        size: response.ContentLength,
      };
    } catch (error: any) {
      console.error('Error downloading file from R2:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.client || !this.config) {
      throw new Error('R2 service not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error: any) {
      console.error('Error generating download URL:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  async renameFile(oldKey: string, newKey: string): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('R2 service not initialized');
    }

    try {
      // Copy object to new key
      const copyCommand = new CopyObjectCommand({
        Bucket: this.config.bucketName,
        CopySource: `${this.config.bucketName}/${oldKey}`,
        Key: newKey,
      });

      await this.client.send(copyCommand);

      // Delete old object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: oldKey,
      });

      await this.client.send(deleteCommand);
    } catch (error: any) {
      console.error('Error renaming file in R2:', error);
      throw new Error(`Failed to rename file: ${error.message}`);
    }
  }

  async moveFile(oldKey: string, newKey: string): Promise<void> {
    // Move is the same as rename in S3/R2
    return this.renameFile(oldKey, newKey);
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('R2 service not initialized');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('Error deleting file from R2:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async getFileInfo(key: string): Promise<R2File | null> {
    if (!this.client || !this.config) {
      throw new Error('R2 service not initialized');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      const name = key.split('/').pop() || key;

      return {
        key,
        name,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        isDirectory: false,
        contentType: response.ContentType,
      };
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return null;
      }
      console.error('Error getting file info from R2:', error);
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }
}

export const r2Service = new R2Service();

