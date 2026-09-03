/**
 * 清理数据库中的孤立数据
 * 删除那些关联的站点已经不存在的记录
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupOrphanedData() {
  console.log('开始清理孤立数据...\n');

  try {
    // 1. 查找所有存在的站点 ID
    const existingSites = await prisma.site.findMany({ select: { id: true } });
    const existingSiteIds = new Set(existingSites.map(s => s.id));
    console.log(`存在的站点数量: ${existingSiteIds.size}`);
    console.log(`站点 IDs: ${Array.from(existingSiteIds).join(', ')}\n`);

    // 2. 查找孤立的 SiteSettings
    const allSiteSettings = await prisma.siteSettings.findMany({ select: { id: true, siteId: true } });
    const orphanedSiteSettings = allSiteSettings.filter(s => !existingSiteIds.has(s.siteId));
    
    if (orphanedSiteSettings.length > 0) {
      console.log(`发现 ${orphanedSiteSettings.length} 条孤立的 SiteSettings 记录:`);
      orphanedSiteSettings.forEach(s => console.log(`  - id=${s.id}, siteId=${s.siteId}`));
      
      const deletedSettings = await prisma.siteSettings.deleteMany({
        where: { siteId: { notIn: Array.from(existingSiteIds) } }
      });
      console.log(`✓ 已删除 ${deletedSettings.count} 条 SiteSettings 记录\n`);
    } else {
      console.log('✓ 没有发现孤立的 SiteSettings 记录\n');
    }

    // 3. 查找孤立的 MediaAsset
    const allMediaAssets = await prisma.mediaAsset.findMany({ select: { id: true, siteId: true } });
    const orphanedMediaAssets = allMediaAssets.filter(m => !existingSiteIds.has(m.siteId));
    
    if (orphanedMediaAssets.length > 0) {
      console.log(`发现 ${orphanedMediaAssets.length} 条孤立的 MediaAsset 记录:`);
      orphanedMediaAssets.forEach(m => console.log(`  - id=${m.id}, siteId=${m.siteId}`));
      
      const deletedAssets = await prisma.mediaAsset.deleteMany({
        where: { siteId: { notIn: Array.from(existingSiteIds) } }
      });
      console.log(`✓ 已删除 ${deletedAssets.count} 条 MediaAsset 记录\n`);
    } else {
      console.log('✓ 没有发现孤立的 MediaAsset 记录\n');
    }

    // 4. 查找孤立的 Review
    const allReviews = await prisma.review.findMany({ select: { id: true, siteId: true } });
    const orphanedReviews = allReviews.filter(r => !existingSiteIds.has(r.siteId));
    
    if (orphanedReviews.length > 0) {
      console.log(`发现 ${orphanedReviews.length} 条孤立的 Review 记录:`);
      orphanedReviews.forEach(r => console.log(`  - id=${r.id}, siteId=${r.siteId}`));
      
      const deletedReviews = await prisma.review.deleteMany({
        where: { siteId: { notIn: Array.from(existingSiteIds) } }
      });
      console.log(`✓ 已删除 ${deletedReviews.count} 条 Review 记录\n`);
    } else {
      console.log('✓ 没有发现孤立的 Review 记录\n');
    }

    // 5. 查找孤立的 FloatingPurchase
    const allFloatingPurchases = await prisma.floatingPurchase.findMany({ select: { id: true, siteId: true } });
    const orphanedFloatingPurchases = allFloatingPurchases.filter(f => !existingSiteIds.has(f.siteId));
    
    if (orphanedFloatingPurchases.length > 0) {
      console.log(`发现 ${orphanedFloatingPurchases.length} 条孤立的 FloatingPurchase 记录:`);
      orphanedFloatingPurchases.forEach(f => console.log(`  - id=${f.id}, siteId=${f.siteId}`));
      
      const deletedPurchases = await prisma.floatingPurchase.deleteMany({
        where: { siteId: { notIn: Array.from(existingSiteIds) } }
      });
      console.log(`✓ 已删除 ${deletedPurchases.count} 条 FloatingPurchase 记录\n`);
    } else {
      console.log('✓ 没有发现孤立的 FloatingPurchase 记录\n');
    }

    // 6. 查找孤立的 ProductSku
    const allProductSkus = await prisma.productSku.findMany({ select: { id: true, siteId: true } });
    const orphanedProductSkus = allProductSkus.filter(p => !existingSiteIds.has(p.siteId));
    
    if (orphanedProductSkus.length > 0) {
      console.log(`发现 ${orphanedProductSkus.length} 条孤立的 ProductSku 记录:`);
      orphanedProductSkus.forEach(p => console.log(`  - id=${p.id}, siteId=${p.siteId}`));
      
      const deletedSkus = await prisma.productSku.deleteMany({
        where: { siteId: { notIn: Array.from(existingSiteIds) } }
      });
      console.log(`✓ 已删除 ${deletedSkus.count} 条 ProductSku 记录\n`);
    } else {
      console.log('✓ 没有发现孤立的 ProductSku 记录\n');
    }

    // 7. 查找孤立的 PaymentSettings
    const allPaymentSettings = await prisma.paymentSettings.findMany({ select: { id: true, siteId: true } });
    const orphanedPaymentSettings = allPaymentSettings.filter(p => !existingSiteIds.has(p.siteId));
    
    if (orphanedPaymentSettings.length > 0) {
      console.log(`发现 ${orphanedPaymentSettings.length} 条孤立的 PaymentSettings 记录:`);
      orphanedPaymentSettings.forEach(p => console.log(`  - id=${p.id}, siteId=${p.siteId}`));
      
      const deletedPaymentSettings = await prisma.paymentSettings.deleteMany({
        where: { siteId: { notIn: Array.from(existingSiteIds) } }
      });
      console.log(`✓ 已删除 ${deletedPaymentSettings.count} 条 PaymentSettings 记录\n`);
    } else {
      console.log('✓ 没有发现孤立的 PaymentSettings 记录\n');
    }

    console.log('清理完成！');
  } catch (error) {
    console.error('清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedData().catch(console.error);
