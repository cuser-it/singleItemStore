import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './app';
import { createMemoryStore } from './store';
import { validateDisplayDate } from '../shared/contentValidation';
import type { MediaAssetInput, ReviewInput } from '../shared/site';

const image: MediaAssetInput = { section: 'hero', sourceType: 'url', source: '/a.jpg', alt: '', sortOrder: 1, enabled: true };
const review: ReviewInput = { name: 'test', content: 'content', images: [], featuredOnHome: false, homeOrder: 0, enabled: true };

describe('content contracts in MemoryStore', () => {
  it('returns defaults and keeps history separate from active public media', async () => {
    const store = createMemoryStore();
    expect((await store.getBootstrap()).settings.heroMediaMode).toBe('image');
    expect((await store.getBootstrap()).heroVideo).toBeNull();
    expect((await store.listMediaAssets())[0]).toMatchObject({ kind: 'image', posterSource: null });
    expect((await store.listReviews())[0].displayDate).toBeNull();
    const second = await store.createSite({ name: 'second', slug: 'second' });
    await store.updateHeroMediaMode('video', 1);
    const video = await store.createMediaAsset({ ...image, kind: 'video', source: '/a.mp4', posterSource: '/poster.jpg' }, 1);
    expect((await store.getBootstrap(1)).heroImages).toEqual([]);
    expect((await store.getBootstrap(1)).heroVideo?.id).toBe(video.id);
    expect((await store.getBootstrap(second.id)).heroImages).toHaveLength(5);
    const settings = await store.getSiteSettings(1);
    await store.updateSiteSettings({ ...settings, heroMediaMode: 'image' } as never, 1);
    expect((await store.getSiteSettings(1)).heroMediaMode).toBe('video');
    await expect(store.createMediaAsset(image, 1)).rejects.toMatchObject({ status: 409 });
    await expect(store.createMediaAsset({ ...image, kind: 'video' }, 1)).rejects.toMatchObject({ status: 409 });
    await expect(store.createMediaAsset({ ...image, section: 'detail', kind: 'video' }, 1)).rejects.toMatchObject({ status: 400 });
    await store.updateHeroMediaMode('image', 1);
    expect((await store.getBootstrap(1)).heroVideo).toBeNull();
    expect((await store.getAdminBootstrap(1)).heroVideo?.id).toBe(video.id);
    await expect(store.deleteMediaAsset(video.id, 1)).rejects.toMatchObject({ status: 409 });
    expect(await store.updateMediaAsset(video.id, image, second.id)).toBeNull();
    for (let n = 5; n < 15; n++) await store.createMediaAsset(image, 1);
    await expect(store.createMediaAsset(image, 1)).rejects.toMatchObject({ status: 409 });
  });

  it('validates calendar dates and preserves dates and ordering on updates', async () => {
    for (const date of ['2025-02-29', '2024-04-31', '2024-2-01', '', '0000-01-01', 20240101]) expect(() => validateDisplayDate(date)).toThrow();
    for (const date of ['2024-02-29', '2025-12-31', null, undefined]) expect(() => validateDisplayDate(date)).not.toThrow();
    const store = createMemoryStore();
    const created = await store.createReview({ ...review, displayDate: '2024-02-29' });
    const ids = (await store.listReviews()).map(item => item.id);
    expect((await store.updateReview(created.id, review))?.displayDate).toBe('2024-02-29');
    const cleared = await store.updateReview(created.id, { ...review, displayDate: null });
    expect(cleared?.displayDate).toBeNull();
    expect(cleared?.createdAt).toBe(created.createdAt);
    expect((await store.listReviews()).map(item => item.id)).toEqual(ids);
  });
});

describe('content API and upload validation', () => {
  const store = createMemoryStore();
  let server: Server;
  let url: string;
  let cookie: string;
  const save = vi.fn(async () => ({ source: '/img/file', resolvedUrl: '/img/file' }));
  const request = (route: string, method = 'GET', body?: unknown) => fetch(`${url}${route}`, { method, headers: { cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  beforeAll(async () => {
    const app = await createApp({ store, adminPassword: 'test', uploadStorage: { save } });
    server = app.listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const login = await request('/api/admin/login', 'POST', { password: 'test' });
    cookie = login.headers.get('set-cookie')!.split(';')[0];
  });
  afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
  const upload = async (query: string, data: Uint8Array, type: string, name: string) => {
    const form = new FormData();
    form.append('file', new Blob([data as BlobPart], { type }), name);
    return fetch(`${url}/api/admin/upload${query}`, { method: 'POST', headers: { cookie }, body: form });
  };
  it('rejects invalid mode/site/date and preserves review date on omitted update', async () => {
    expect((await request('/api/admin/hero-media-mode', 'PUT', { siteId: 1, mode: 'bad' })).status).toBe(400);
    expect((await request('/api/admin/hero-media-mode', 'PUT', { siteId: 999, mode: 'video' })).status).toBe(404);
    expect((await request('/api/admin/media-assets', 'POST', { ...image, siteId: 'bad' })).status).toBe(400);
    expect((await request('/api/admin/reviews', 'POST', { ...review, displayDate: '2025-02-29' })).status).toBe(400);
    const created = await (await request('/api/admin/reviews', 'POST', { ...review, displayDate: '2024-02-29' })).json();
    expect((await (await request(`/api/admin/reviews/${created.id}`, 'PUT', review)).json()).displayDate).toBe('2024-02-29');
    expect((await (await request(`/api/admin/reviews/${created.id}`, 'PUT', { ...review, displayDate: null })).json()).displayDate).toBeNull();
  });
  it('accepts legacy images, enforces active modes, MP4 headers and poster images', async () => {
    const png = new Uint8Array([137,80,78,71,13,10,26,10,0]);
    const mp4 = new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109]);
    expect((await upload('', png, 'image/png', 'old.png')).status).toBe(201);
    expect((await upload('', png, 'text/plain', 'old.txt')).status).toBe(400);
    expect((await upload('?siteId=1&section=hero&kind=video', mp4, 'video/mp4', 'a.mp4')).status).toBe(409);
    expect((await request('/api/admin/hero-media-mode', 'PUT', { siteId: 1, mode: 'video' })).status).toBe(200);
    expect((await request('/api/admin/media-assets', 'POST', image)).status).toBe(409);
    expect((await upload('?siteId=1&section=hero&kind=image', png, 'image/png', 'a.png')).status).toBe(409);
    expect((await upload('?siteId=1&section=hero&kind=video', mp4, 'video/mp4', 'a.mp4')).status).toBe(201);
    expect((await upload('?siteId=1&section=hero&kind=video', png, 'video/mp4', 'a.mp4')).status).toBe(400);
    expect((await upload('?siteId=1&section=hero&kind=video&purpose=poster', png, 'image/png', 'poster.png')).status).toBe(201);
    expect((await upload('?section=detail&kind=video', mp4, 'video/mp4', 'a.mp4')).status).toBe(400);
    vi.stubEnv('MAX_VIDEO_UPLOAD_SIZE_MB', '1');
    expect((await upload('?section=hero&kind=video', new Uint8Array(1024 * 1024 + 1), 'video/mp4', 'big.mp4')).status).toBe(413);
  });
});
