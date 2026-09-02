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
  it('returns a clear 413 response when an upload is too large', async () => {
    await login();

    const uploadForm = new FormData();
    uploadForm.append('file', new Blob([new Uint8Array(21 * 1024 * 1024)], { type: 'image/jpeg' }), 'too-large.jpg');

    const uploadResponse = await fetch(`${baseUrl}/api/admin/upload`, {
      method: 'POST',
      headers: { cookie: authCookie },
      body: uploadForm,
    });

    expect(uploadResponse.status).toBe(413);
    await expect(uploadResponse.json()).resolves.toEqual({ message: '图片过大，请上传不超过 20MB 的文件' });
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
  it('copies a site template and keeps site content isolated after switching', async () => {
    await login();

    const createResponse = await fetch(`${baseUrl}/api/admin/sites`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '第二站点', slug: 'second-site', templateSiteId: 1 }),
    });
    expect(createResponse.status).toBe(201);
    const createdSite = (await createResponse.json()) as { id: number; name: string; isActive: boolean };
    expect(createdSite.isActive).toBe(false);

    const switchResponse = await fetch(`${baseUrl}/api/admin/sites/${createdSite.id}/activate`, {
      method: 'POST',
      headers: { cookie: authCookie },
    });
    expect(switchResponse.status).toBe(200);

    const secondBootstrap = await fetch(`${baseUrl}/api/admin/bootstrap`, { headers: { cookie: authCookie } }).then((response) => response.json()) as {
      activeSiteId: number;
      sites: Array<{ id: number; isActive: boolean }>;
      settings: { siteId: number; shopName: string };
      detailImages: Array<{ id: number; siteId: number; source: string }>;
    };
    expect(secondBootstrap.activeSiteId).toBe(createdSite.id);
    expect(secondBootstrap.settings.siteId).toBe(createdSite.id);
    expect(secondBootstrap.detailImages.every((item) => item.siteId === createdSite.id)).toBe(true);

    const firstDetailId = secondBootstrap.detailImages[0]?.id;
    expect(firstDetailId).toBeTypeOf('number');
    await fetch(`${baseUrl}/api/admin/media-assets/${firstDetailId}`, { method: 'DELETE', headers: { cookie: authCookie } });
    await fetch(`${baseUrl}/api/admin/site-settings`, {
      method: 'PUT',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...defaultSettingsPayload(), shopName: '第二站点店铺' }),
    });

    const secondDetailImages = await fetch(`${baseUrl}/api/public/detail-images`).then((response) => response.json()) as Array<{ siteId: number; source: string }>;
    expect(secondDetailImages.every((item) => item.siteId === createdSite.id)).toBe(true);
    expect(secondDetailImages.length).toBe(secondBootstrap.detailImages.length - 1);

    await fetch(`${baseUrl}/api/admin/sites/1/activate`, { method: 'POST', headers: { cookie: authCookie } });
    const firstBootstrap = await fetch(`${baseUrl}/api/admin/bootstrap`, { headers: { cookie: authCookie } }).then((response) => response.json()) as {
      activeSiteId: number;
      settings: { siteId: number; shopName: string };
      detailImages: Array<{ siteId: number }>;
    };
    expect(firstBootstrap.activeSiteId).toBe(1);
    expect(firstBootstrap.settings.shopName).not.toBe('第二站点店铺');
    expect(firstBootstrap.detailImages.every((item) => item.siteId === 1)).toBe(true);
    expect(firstBootstrap.detailImages.length).toBeGreaterThan(secondDetailImages.length);
  });
});

function defaultSettingsPayload() {
  return {
    shopName: '单品商城 · 正品官方',
    title: '参茸 养心益肾胶囊 正品官方 勃起苦困难 阳痿早泄 OTC 国药准字',
    subtitle: '本品售出，非质量问题不退不换',
    highlight: '立赠1盒男士战斗礼包，中西结合更强更科学',
    serviceNote: '免费包邮 · 18:00 前下单承诺当日发出',
    guarantee: ['商城官方自营'],
    productDescription: '立赠1盒男士战斗礼包，中西结合更强更科学',
    shippingNote: '免费包邮',
    reminder: '正品保证，不仅全，而且更安全',
    shippingTime: '18:00 前下单，承诺当日发出',
    salePrice: 99,
    originalPrice: 299,
    soldText: '50000+已售',
    marqueeText: 'xxx购买',
    reviewTags: ['效果明显'],
    productVariants: [{ id: 'single', name: '单盒体验装', subtitle: '先试用再决定', price: 99, originalPrice: 299, saleLabel: '券后价' }],
    heroImageCount: 5,
  };
}
