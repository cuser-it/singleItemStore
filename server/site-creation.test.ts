import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('站点创建功能测试', () => {
  let testSiteId: number;

  afterAll(async () => {
    // 清理测试数据
    if (testSiteId) {
      await prisma.site.delete({ where: { id: testSiteId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('应该能够创建带有完整 SiteSettings 的新站点', async () => {
    // 获取默认站点作为模板
    const defaultSite = await prisma.site.findFirst({
      where: { slug: 'default' },
      include: { settings: true }
    });

    expect(defaultSite).toBeTruthy();
    expect(defaultSite?.settings).toBeTruthy();
    expect(defaultSite?.settings?.salePrice).toBeTruthy();
    expect(defaultSite?.settings?.originalPrice).toBeTruthy();

    // 创建新站点
    const newSite = await prisma.site.create({
      data: {
        name: '测试站点',
        slug: 'test-site-' + Date.now(),
        isActive: false,
      }
    });

    testSiteId = newSite.id;

    // 复制 SiteSettings
    const templateSettings = defaultSite!.settings!;
    const newSettings = await prisma.siteSettings.create({
      data: {
        siteId: newSite.id,
        shopName: templateSettings.shopName,
        title: templateSettings.title,
        subtitle: templateSettings.subtitle,
        highlight: templateSettings.highlight,
        serviceNote: templateSettings.serviceNote,
        guarantee: templateSettings.guarantee,
        productDescription: templateSettings.productDescription,
        shippingNote: templateSettings.shippingNote,
        reminder: templateSettings.reminder,
        shippingTime: templateSettings.shippingTime,
        salePrice: templateSettings.salePrice,
        originalPrice: templateSettings.originalPrice,
        soldText: templateSettings.soldText,
        marqueeText: templateSettings.marqueeText,
        reviewTags: templateSettings.reviewTags,
        productVariants: templateSettings.productVariants,
        heroImageCount: templateSettings.heroImageCount,
        paymentSuccessMessage: templateSettings.paymentSuccessMessage,
        customerServiceUrl: templateSettings.customerServiceUrl,
        customerServiceQrCode: templateSettings.customerServiceQrCode,
      }
    });

    // 验证创建成功
    expect(newSettings).toBeTruthy();
    expect(newSettings.salePrice).toBe(templateSettings.salePrice);
    expect(newSettings.originalPrice).toBe(templateSettings.originalPrice);
    expect(newSettings.productVariants).toEqual(templateSettings.productVariants);

    console.log(`✅ 站点创建成功！站点 ID: ${newSite.id}, salePrice: ${newSettings.salePrice}, originalPrice: ${newSettings.originalPrice}`);
  });

  it('应该能够从默认站点复制完整的数据', async () => {
    const defaultSite = await prisma.site.findFirst({
      where: { slug: 'default' },
      include: {
        settings: true,
        mediaAssets: true,
        reviews: true,
        floatingPurchases: true,
      }
    });

    expect(defaultSite).toBeTruthy();
    expect(defaultSite?.settings).toBeTruthy();

    // 验证默认站点的 SiteSettings 包含所有必需字段
    const settings = defaultSite!.settings!;
    expect(settings.salePrice).toBeTruthy();
    expect(settings.originalPrice).toBeTruthy();
    expect(settings.productVariants).toBeDefined();
    expect(typeof settings.salePrice).toBe('number');
    expect(typeof settings.originalPrice).toBe('number');

    console.log(`✅ 默认站点数据完整！salePrice: ${settings.salePrice}, originalPrice: ${settings.originalPrice}, productVariants: ${JSON.stringify(settings.productVariants).substring(0, 100)}...`);
  });
});
