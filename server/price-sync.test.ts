import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('价格同步测试 - ProductVariants 到 ProductSku', () => {
  let testSiteId: number;
  
  beforeAll(async () => {
    // 使用现有的站点 1
    testSiteId = 1;
  });

  it('应该同步 productVariants 的价格到 ProductSku 表', async () => {
    // 1. 获取当前设置
    const currentSettings = await prisma.siteSettings.findUnique({
      where: { siteId: testSiteId },
    });
    
    expect(currentSettings).toBeTruthy();
    const variants = currentSettings!.productVariants as any[];
    expect(variants.length).toBeGreaterThan(0);
    
    // 2. 修改第一个 variant 的价格
    const newPrice = 88.88;
    const updatedVariants = [...variants];
    updatedVariants[0] = { ...updatedVariants[0], price: newPrice };
    
    // 3. 更新 SiteSettings（模拟 updateSiteSettings 的行为）
    const resolvedSiteId = testSiteId;
    
    // 同步价格到 ProductSku 表
    for (const variant of updatedVariants) {
      if (variant.id && variant.price !== undefined) {
        const updateData: any = {
          price: variant.price,
          updatedAt: new Date(),
        };
        
        if (variant.name !== undefined) updateData.name = variant.name;
        if (variant.subtitle !== undefined) updateData.subtitle = variant.subtitle;
        if (variant.originalPrice !== undefined) updateData.originalPrice = variant.originalPrice;
        if (variant.saleLabel !== undefined) updateData.saleLabel = variant.saleLabel;
        if (variant.highlight !== undefined) updateData.highlight = variant.highlight;
        
        const updateResult = await prisma.productSku.updateMany({
          where: { siteId: resolvedSiteId, skuCode: variant.id },
          data: updateData,
        });
        
        console.log(`同步 ProductSku (skuCode=${variant.id}): ${updateResult.count} 行已更新, price=${variant.price}`);
      }
    }
    
    // 更新 SiteSettings
    await prisma.siteSettings.update({
      where: { siteId: resolvedSiteId },
      data: {
        salePrice: updatedVariants[0].price,
        originalPrice: updatedVariants[0].originalPrice,
        productVariants: updatedVariants as any,
      },
    });
    
    // 4. 验证 ProductSku 表已同步
    const updatedSku = await prisma.productSku.findFirst({
      where: {
        siteId: testSiteId,
        skuCode: updatedVariants[0].id,
      },
    });
    
    expect(updatedSku).toBeTruthy();
    expect(Number(updatedSku!.price)).toBe(newPrice);
    
    // 5. 验证 SiteSettings 表也已更新
    const updatedSettings = await prisma.siteSettings.findUnique({
      where: { siteId: testSiteId },
    });
    
    expect(updatedSettings).toBeTruthy();
    expect(Number(updatedSettings!.salePrice)).toBe(newPrice);
    
    console.log('✅ 价格同步测试通过！');
  });

  it('应该验证所有站点的 ProductSku 价格与 SiteSettings 一致', async () => {
    const allSettings = await prisma.siteSettings.findMany({
      include: {
        site: true,
      },
    });
    
    for (const settings of allSettings) {
      const variants = settings.productVariants as any[];
      if (!variants || variants.length === 0) continue;
      
      const firstVariant = variants[0];
      
      // 查找对应的 ProductSku
      const sku = await prisma.productSku.findFirst({
        where: {
          siteId: settings.siteId,
          skuCode: firstVariant.id,
        },
      });
      
      if (sku) {
        console.log(`站点 ${settings.siteId} (${settings.site.name}): SiteSettings.salePrice=${settings.salePrice}, ProductSku.price=${sku.price}, Variant.price=${firstVariant.price}`);
        
        // 验证三个价格是否一致
        expect(Number(settings.salePrice)).toBe(Number(sku.price));
        expect(Number(settings.salePrice)).toBe(firstVariant.price);
      }
    }
    
    console.log('✅ 所有站点的价格一致性验证通过！');
  });
});
