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
  // 恢复：删除测试站点，并把原本的第一个活动站点恢复为唯一活动站点
  if (createdSiteId) {
    await prisma.siteSettings.deleteMany({ where: { siteId: createdSiteId } });
    await prisma.productSku.deleteMany({ where: { siteId: createdSiteId } }).catch(() => undefined);
    await prisma.site.delete({ where: { id: createdSiteId } }).catch(() => undefined);
  }
  const restoreId = originalActiveIds[0];
  if (restoreId) {
    await prisma.$transaction([
      prisma.site.updateMany({ data: { isActive: false } }),
      prisma.site.update({ where: { id: restoreId }, data: { isActive: true } }),
    ]);
  }
  await prisma.$disconnect();
});

describe('Prisma 存储：客服配置字段与活动站点唯一性', () => {
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

  it('switchSite 激活一个站点后，数据库中必须只有一个 isActive = true', async () => {
    const created = await store.createSite({ name: `唯一性测试_${Date.now()}`, slug: `uniq-${Date.now()}` });
    createdSiteId = created.id;
    await store.switchSite(created.id);
    const actives = await prisma.site.findMany({ where: { isActive: true } });
    expect(actives.map((s) => s.id)).toEqual([created.id]);
    expect((await store.getActiveSite()).id).toBe(created.id);
  });
});
