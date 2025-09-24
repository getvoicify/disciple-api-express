export interface R2Config {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl?: string;
}

export interface UploadResult {
    r2Url: string;
    r2Key: string;
}

export interface PresignedUploadResult {
    uploadUrl: string;
    r2Key: string;
}

// Interface for R2 service
export interface CloudflareR2Service {
    uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<UploadResult>;
    deleteFile(r2Key: string): Promise<void>;
    generatePresignedUploadUrl(filename: string, mimeType: string): Promise<PresignedUploadResult>;
}

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { safeExecute } from '../utils/handle-async';
import {
    R2ConfigurationError,
    R2UploadError,
    R2DeleteError,
    R2PresignedUrlError,
    FileValidationError,
    InvalidFilenameError,
    extractR2ErrorMessage
} from './errors';

// Implementation of the R2 service
export class CloudflareR2ServiceImpl implements CloudflareR2Service {
    private readonly config: R2Config;
    private readonly s3Client: S3Client;

    constructor(config?: R2Config) {
        this.config = config || this.getConfigFromEnvironment();
        this.validateConfig(this.config);

        // Initialize S3 client for R2
        this.s3Client = new S3Client({
            region: 'auto', // R2 uses 'auto' region
            endpoint: this.config.endpoint,
            credentials: {
                accessKeyId: this.config.accessKeyId,
                secretAccessKey: this.config.secretAccessKey,
            },
        });
    }

    async uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
        if (!fileBuffer || fileBuffer.length === 0) {
            throw new FileValidationError('File buffer cannot be empty', filename);
        }
        if (!filename || filename.trim() === '') {
            throw new InvalidFilenameError('', 'filename cannot be empty');
        }

        const sanitizedFilename = this.sanitizeFilename(filename);
        const r2Key = this.generateFileKey(sanitizedFilename);

        const command = new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: r2Key,
            Body: fileBuffer,
            ContentType: mimeType,
        });

        const [err] = await safeExecute(this.s3Client.send(command));

        if (err) {
            throw new R2UploadError(extractR2ErrorMessage(err), filename, r2Key);
        }

        const r2Url = this.config.publicBaseUrl
            ? `${this.config.publicBaseUrl}/${r2Key}`
            : `${this.config.endpoint}/${this.config.bucket}/${r2Key}`;

        return { r2Url, r2Key };
    }

    async deleteFile(r2Key: string): Promise<void> {
        if (!r2Key || r2Key.trim() === '') {
            throw new FileValidationError('R2 key cannot be empty');
        }

        const command = new DeleteObjectCommand({
            Bucket: this.config.bucket,
            Key: r2Key,
        });

        const [err] = await safeExecute(this.s3Client.send(command));

        if (err) {
            throw new R2DeleteError(r2Key, extractR2ErrorMessage(err));
        }
    }

    async generatePresignedUploadUrl(filename: string, mimeType: string): Promise<PresignedUploadResult> {
        if (!filename || filename.trim() === '') {
            throw new InvalidFilenameError('', 'filename cannot be empty');
        }
        if (!mimeType || mimeType.trim() === '') {
            throw new FileValidationError('MIME type cannot be empty', filename);
        }

        const sanitizedFilename = this.sanitizeFilename(filename);
        const r2Key = this.generateFileKey(sanitizedFilename);

        const command = new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: r2Key,
            ContentType: mimeType,
        });

        const [err, uploadUrl] = await safeExecute(
            getSignedUrl(this.s3Client, command, { expiresIn: 3600 }) // 1 hour expiration
        );

        if (err) {
            throw new R2PresignedUrlError(extractR2ErrorMessage(err), filename);
        }

        return { uploadUrl, r2Key };
    }

    private validateConfig(config: R2Config): void {
        if (!config.endpoint) {
            throw new R2ConfigurationError('R2_ENDPOINT environment variable');
        }
        if (!config.accessKeyId) {
            throw new R2ConfigurationError('R2_ACCESS_KEY_ID environment variable');
        }
        if (!config.secretAccessKey) {
            throw new R2ConfigurationError('R2_SECRET_ACCESS_KEY environment variable');
        }
        if (!config.bucket) {
            throw new R2ConfigurationError('R2_BUCKET_NAME environment variable');
        }

        if (!config.endpoint.startsWith('http')) {
            throw new R2ConfigurationError('R2 endpoint must be a valid URL');
        }
    }

    private sanitizeFilename(filename: string): string {
        // Remove or replace unsafe characters for R2 keys
        // Convert to lowercase and replace unsafe chars with underscores
        return filename
            .toLowerCase()
            .replace(/[^a-z0-9.-]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    private generateFileKey(filename: string): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        // Generate hex string to match test pattern [0-9a-f-]+
        const uuid = crypto.randomUUID();

        return `uploads/${year}/${month}/${day}/${uuid}_${filename}`;
    }

    private getConfigFromEnvironment(): R2Config {
        return {
            endpoint: process.env.R2_ENDPOINT || '',
            accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
            bucket: process.env.R2_BUCKET_NAME || '',
            publicBaseUrl: process.env.R2_PUBLIC_URL_BASE,
        };
    }

    static fromEnvironment(): CloudflareR2Service {
        return new CloudflareR2ServiceImpl();
    }
}
