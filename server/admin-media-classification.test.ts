import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultBootstrap } from '../shared/site';
const mock = vi.hoisted(() => {
  const table = () => ({ count: vi.fn(async () => 1), findUnique: vi.fn(), findMany: vi.fn(async () => []), upsert: vi.fn() });
  return { $executeRawUnsafe: vi.fn(), site: table(), siteSettings: table(), mediaAsset: table(), review: table(), floatingPurchase: table() };
});
vi.mock('@prisma/client', () => ({ PrismaClient: class { constructor() { return mock; } }, Prisma: {} }));
import { createPrismaStore } from './prismaStore';
afterEach(() => vi.unstubAllEnvs());

describe('Prisma admin media classification', () => {
  it('returns video exactly once and keeps detail and carousel images separate in either mode', async () => {
    // Prisma is fully mocked: this never connects to any database.
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@127.0.0.1/fsd');
    const timestamps = { createdAt: new Date(), updatedAt: new Date() };
    const site = { ...defaultBootstrap.site, ...timestamps };
    const settings = { ...defaultBootstrap.settings, ...timestamps, heroMediaMode: 'video' };
    mock.site.upsert.mockResolvedValue(site);
    mock.site.findUnique.mockResolvedValue(site);
    mock.site.findMany.mockResolvedValue([site] as never);
    mock.siteSettings.findUnique.mockResolvedValue(settings);
    const base = { ...defaultBootstrap.heroImages[0], ...timestamps, siteId: 1, enabled: true };
    mock.mediaAsset.findMany.mockResolvedValue([
      { ...base, id: 10, section: 'hero', kind: 'image' },
      { ...base, id: 11, section: 'hero', kind: 'video', source: '/video.mp4' },
      { ...base, id: 12, section: 'detail', kind: 'image' },
    ] as never);
    const store = await createPrismaStore();
    for (const mode of ['video', 'image']) {
      settings.heroMediaMode = mode;
      const admin = await store.getAdminBootstrap(1);
      expect(admin.heroImages.map(item => item.id)).toEqual([10]);
      expect(admin.heroVideo?.id).toBe(11);
      expect(admin.detailImages.map(item => item.id)).toEqual([12]);
    }
  });
});
