import { describe, expect, it, vi } from 'vitest';
import { createS3UploadStorage, createUploadStorageFromEnv } from './uploadStorage';

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  S3Client: vi.fn().mockImplementation((config) => ({ config, send: sendMock })),
}));

describe('upload storage', () => {
  it('uses local storage when S3 configuration is incomplete', () => {
    const storage = createUploadStorageFromEnv({}, '/tmp/uploads');
    expect(storage).toHaveProperty('save');
  });

  it('uploads to an S3-compatible bucket and returns the public URL', async () => {
    sendMock.mockResolvedValueOnce({});
    const storage = createS3UploadStorage({
      bucket: 'product-media',
      region: 'us-east-1',
      endpoint: 'https://rustfs.example.com',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      publicBaseUrl: 'https://cdn.example.com/product-media',
      keyPrefix: 'reviews',
    });

    const result = await storage.save({
      originalname: 'review.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('image'),
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as { input: { Bucket: string; Key: string; ContentType: string; Body: Buffer } };
    expect(command.input.Bucket).toBe('product-media');
    expect(command.input.Key).toMatch(/^reviews\/.+\.jpg$/);
    expect(command.input.ContentType).toBe('image/jpeg');
    expect(result.source).toBe(`https://cdn.example.com/product-media/${command.input.Key}`);
    expect(result.resolvedUrl).toBe(result.source);
  });
});
