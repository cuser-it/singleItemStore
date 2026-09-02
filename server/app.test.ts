import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from './app';
import { createMemoryStore } from './store';

const uploadDir = mkdtempSync(path.join(os.tmpdir(), 'single-item-store-upload-'));
let server: Server | null = null;
let baseUrl = '';
let authCookie = '';

async function startServer() {
  const app = await createApp({ store: createMemoryStore(), uploadDir });
  const httpServer = app.listen(0);
  await new Promise<void>((resolve) => httpServer.once('listening', resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind test server');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  return httpServer;
}

async function login() {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123456' }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie');
  if (!cookie) {
    throw new Error('expected auth cookie');
  }
  authCookie = cookie.split(';')[0];
}

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await new Promise<void>((resolve) => (server as unknown as { close: (cb: () => void) => void }).close(() => resolve()));
  rmSync(uploadDir, { recursive: true, force: true });
});

describe('backend', () => {
  it('authenticates and protects admin endpoints', async () => {
    const denied = await fetch(`${baseUrl}/api/admin/me`);
    expect(denied.status).toBe(401);

    await login();

    const allowed = await fetch(`${baseUrl}/api/admin/me`, { headers: { cookie: authCookie } });
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toEqual({ authenticated: true });
  });

  it('stores uploaded media and preserves URL media and detail ordering', async () => {
    await login();

    const uploadForm = new FormData();
    uploadForm.append('file', new Blob(['hello image'], { type: 'text/plain' }), 'hero.txt');

    const uploadResponse = await fetch(`${baseUrl}/api/admin/upload`, {
      method: 'POST',
      headers: { cookie: authCookie },
      body: uploadForm,
    });
    expect(uploadResponse.status).toBe(201);
    const uploadResult = (await uploadResponse.json()) as { source: string; resolvedUrl: string };
    expect(uploadResult.source).toMatch(/^\/img\//);
    expect(uploadResult.resolvedUrl).toBe(uploadResult.source);

    const urlMediaResponse = await fetch(`${baseUrl}/api/admin/media-assets`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'detail',
        sourceType: 'url',
        source: 'https://example.com/detail-99.jpg',
        alt: 'detail-99',
        sortOrder: 99,
        enabled: true,
      }),
    });
    expect(urlMediaResponse.status).toBe(201);

    const publicBootstrap = await fetch(`${baseUrl}/api/public/bootstrap`).then((response) => response.json()) as {
      heroImages: Array<{ resolvedUrl: string; source: string }>;
      detailImages: Array<{ resolvedUrl: string; source: string; sortOrder: number }>;
      reviews: Array<unknown>;
    };

    expect(publicBootstrap.heroImages.some((item) => item.resolvedUrl.startsWith('/img/'))).toBe(true);
    expect(publicBootstrap.detailImages.at(-1)?.resolvedUrl).toBe('https://example.com/detail-99.jpg');
  });

  it('returns the newest reviews first and keeps the homepage list at two items', async () => {
    await login();

    await fetch(`${baseUrl}/api/admin/reviews`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '旧评论',
        content: 'older review',
        images: [],
        featuredOnHome: true,
        homeOrder: 10,
        enabled: true,
      }),
    });

    await fetch(`${baseUrl}/api/admin/reviews`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '新评论',
        content: 'newer review',
        images: [],
        featuredOnHome: true,
        homeOrder: 1,
        enabled: true,
      }),
    });

    const allReviews = (await fetch(`${baseUrl}/api/public/reviews/all`).then((response) => response.json())) as Array<{ name: string }>;
    expect(allReviews[0]?.name).toBe('新评论');

    const topReviews = (await fetch(`${baseUrl}/api/public/reviews?limit=2`).then((response) => response.json())) as Array<{ name: string }>;
    expect(topReviews).toHaveLength(2);
    expect(topReviews[0]?.name).toBe('新评论');

    await fetch(`${baseUrl}/api/admin/media-assets`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'detail',
        sourceType: 'url',
        source: 'https://example.com/detail-100.jpg',
        alt: 'detail-100',
        sortOrder: 100,
        enabled: true,
      }),
    });

    const detailImages = (await fetch(`${baseUrl}/api/public/detail-images`).then((response) => response.json())) as Array<{ sortOrder: number }>;
    const tail = detailImages.slice(-2).map((item) => item.sortOrder);
    expect(tail).toEqual([99, 100]);
  });
});
