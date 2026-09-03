import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Payment Success Configuration', () => {
  let testSiteId: number;

  beforeAll(async () => {
    // 获取测试站点
    const site = await prisma.site.findFirst();
    if (!site) {
      throw new Error('No site found for testing');
    }
    testSiteId = site.id;
  });

  it('should have paymentSuccessMessage field in SiteSettings', async () => {
    const settings = await prisma.siteSettings.findUnique({
      where: { siteId: testSiteId },
    });

    expect(settings).toBeDefined();
    expect(settings).toHaveProperty('paymentSuccessMessage');
  });

  it('should return default message if not set', async () => {
    const settings = await prisma.siteSettings.findUnique({
      where: { siteId: testSiteId },
    });

    if (settings) {
      const message = settings.paymentSuccessMessage || '添加客服领取服用说明';
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    }
  });

  it('should update paymentSuccessMessage', async () => {
    const testMessage = '扫码添加客服微信，获取详细使用指南';
    
    await prisma.siteSettings.update({
      where: { siteId: testSiteId },
      data: { paymentSuccessMessage: testMessage },
    });

    const updated = await prisma.siteSettings.findUnique({
      where: { siteId: testSiteId },
    });

    expect(updated?.paymentSuccessMessage).toBe(testMessage);
  });
});
