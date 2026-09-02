import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

export type UploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export type UploadResult = {
  source: string;
  resolvedUrl: string;
};

export type UploadStorage = {
  save: (file: UploadFile) => Promise<UploadResult>;
};

type LocalStorageOptions = {
  uploadDir: string;
};

type S3StorageOptions = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  keyPrefix?: string;
  forcePathStyle?: boolean;
};

function extensionFor(fileName: string) {
  return path.extname(fileName) || '.bin';
}

function buildObjectKey(fileName: string, keyPrefix = '') {
  const prefix = keyPrefix.trim().replace(/^\/+|\/+$/g, '');
  const key = `${randomUUID()}${extensionFor(fileName)}`;
  return prefix ? `${prefix}/${key}` : key;
}

function publicUrlFor(options: S3StorageOptions, key: string) {
  if (options.publicBaseUrl) {
    return `${options.publicBaseUrl.replace(/\/+$/g, '')}/${key}`;
  }
  if (options.endpoint) {
    return `${options.endpoint.replace(/\/+$/g, '')}/${options.bucket}/${key}`;
  }
  return `https://${options.bucket}.s3.${options.region}.amazonaws.com/${key}`;
}

export function createLocalUploadStorage(options: LocalStorageOptions): UploadStorage {
  return {
    async save(file) {
      await mkdir(options.uploadDir, { recursive: true });
      const fileName = `${randomUUID()}${extensionFor(file.originalname)}`;
      const fullPath = path.join(options.uploadDir, fileName);
      await writeFile(fullPath, file.buffer);
      const source = `/img/${fileName}`;
      return { source, resolvedUrl: source };
    },
  };
}

export function createS3UploadStorage(options: S3StorageOptions): UploadStorage {
  const client = new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  });

  return {
    async save(file) {
      const key = buildObjectKey(file.originalname, options.keyPrefix);
      await client.send(new PutObjectCommand({
        Bucket: options.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
      }));
      const source = publicUrlFor(options, key);
      return { source, resolvedUrl: source };
    },
  };
}

export function createUploadStorageFromEnv(env: NodeJS.ProcessEnv, uploadDir: string): UploadStorage {
  const bucket = env.S3_BUCKET || env.AWS_S3_BUCKET;
  const accessKeyId = env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;

  if (bucket && accessKeyId && secretAccessKey) {
    return createS3UploadStorage({
      bucket,
      accessKeyId,
      secretAccessKey,
      endpoint: env.S3_ENDPOINT || env.AWS_S3_ENDPOINT,
      region: env.S3_REGION || env.AWS_REGION || 'auto',
      publicBaseUrl: env.S3_PUBLIC_BASE_URL,
      keyPrefix: env.S3_KEY_PREFIX || 'uploads',
      forcePathStyle: env.S3_FORCE_PATH_STYLE ? env.S3_FORCE_PATH_STYLE !== 'false' : undefined,
    });
  }

  return createLocalUploadStorage({ uploadDir });
}
