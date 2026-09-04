import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createPrismaStore } from './prismaStore';

const prisma = new PrismaClient();
let store: Awaited<ReturnType<typeof createPrismaStore>>;
let createdSiteId: number | null = null;
let originalActiveIds: number[] = [];

beforeAll(async () => {
  store = await createPrismaStore();
  originalActiveIds = (await prisma.site.findMany({ where: { isActive: true }, select: { id: true } })).map((s) => s.id);
});

afterAll(async () => {
  // 恢复：删除测试站点，并恢复原本的活动站点集合
  if (createdSiteId) {
    await prisma.siteSettings.deleteMany({ where: { siteId: createdSiteId } });
    await prisma.productSku.deleteMany({ where: { siteId: createdSiteId } }).catch(() => undefined);
    await prisma.site.delete({ where: { id: createdSiteId } }).catch(() => undefined);
  }
  await prisma.site.updateMany({ data: { isActive: false } });
  if (originalActiveIds.length) {
    await prisma.site.updateMany({ where: { id: { in: originalActiveIds } }, data: { isActive: true } });
  }
  await prisma.$disconnect();
});

describe('Prisma 存储：客服配置字段与多活动站点', () => {
  it('updateSiteSettings 应写入并读回 paymentSuccessMessage / customerServiceUrl / customerServiceQrCode', async () => {
    const active = await store.getActiveSite();
    const before = await store.getSiteSettings(active.id);
    expect(before).toBeTruthy();
    try {
      const updated = await store.updateSiteSettings({ ...before!, paymentSuccessMessage: '测试文案', customerServiceUrl: 'weixin://dl/business/?t=unit-test', customerServiceQrCode: '/img/unit-test-qr.png' }, active.id);
      expect(updated.paymentSuccessMessage).toBe('测试文案');
      expect(updated.customerServiceUrl).toBe('weixin://dl/business/?t=unit-test');
      expect(updated.customerServiceQrCode).toBe('/img/unit-test-qr.png');
      const row = await prisma.siteSettings.findUnique({ where: { siteId: active.id } });
      expect(row?.customerServiceUrl).toBe('weixin://dl/business/?t=unit-test');
      expect(row?.customerServiceQrCode).toBe('/img/unit-test-qr.png');
      const readBack = await store.getSiteSettings(active.id);
      expect(readBack?.customerServiceQrCode).toBe('/img/unit-test-qr.png');
    } finally {
      await store.updateSiteSettings(before!, active.id);
    }
  });

  it('switchSite 切换单个站点启用状态时，不会关闭其他已启用站点', async () => {
    const existingActiveIds = (await prisma.site.findMany({ where: { isActive: true }, select: { id: true } })).map((s) => s.id);
    expect(existingActiveIds.length).toBeGreaterThan(0);
    const created = await store.createSite({ name: `多活动站点测试_${Date.now()}`, slug: `multi-active-${Date.now()}` });
    createdSiteId = created.id;

    const activated = await store.switchSite(created.id);
    expect(activated?.isActive).toBe(true);

    const actives = await prisma.site.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
    expect(actives.map((s) => s.id)).toEqual([...existingActiveIds, created.id].sort((a, b) => a - b));
    expect((await store.getSiteBySlug(created.slug))?.isActive).toBe(true);
  });
});
