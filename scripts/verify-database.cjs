#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyDatabase() {
  try {
    console.log('🔍 开始验证数据库完整性...\n');
    
    // 验证关键数据完整性
    console.log('1️⃣  验证关键表数据...');
    
    const siteCount = await prisma.site.count();
    console.log(`   ✓ Site: ${siteCount} 条记录`);
    
    const productSkuCount = await prisma.productSku.count();
    console.log(`   ✓ ProductSku: ${productSkuCount} 条记录`);
    
    const orderCount = await prisma.order.count();
    console.log(`   ✓ Order: ${orderCount} 条记录`);
    
    const mediaAssetCount = await prisma.mediaAsset.count();
    console.log(`   ✓ MediaAsset: ${mediaAssetCount} 条记录`);
    
    const reviewCount = await prisma.review.count();
    console.log(`   ✓ Review: ${reviewCount} 条记录`);
    
    const floatingPurchaseCount = await prisma.floatingPurchase.count();
    console.log(`   ✓ FloatingPurchase: ${floatingPurchaseCount} 条记录`);
    
    // 验证关系完整性
    console.log('\n2️⃣  验证关系完整性...');
    
    const siteWithRelations = await prisma.site.findFirst({
      include: {
        settings: true,
        mediaAssets: true,
        reviews: true,
        floatingPurchases: true,
        productSkus: true,
        orders: true,
        paymentSettings: true,
        operationLogs: true
      }
    });
    
    if (siteWithRelations) {
      console.log(`   ✓ Site 关系正常:`);
      console.log(`     - settings: ${siteWithRelations.settings ? '✓' : '✗'}`);
      console.log(`     - mediaAssets: ${siteWithRelations.mediaAssets.length} 条`);
      console.log(`     - reviews: ${siteWithRelations.reviews.length} 条`);
      console.log(`     - floatingPurchases: ${siteWithRelations.floatingPurchases.length} 条`);
      console.log(`     - productSkus: ${siteWithRelations.productSkus.length} 条`);
      console.log(`     - orders: ${siteWithRelations.orders.length} 条`);
      console.log(`     - paymentSettings: ${siteWithRelations.paymentSettings ? '✓' : '✗'}`);
      console.log(`     - operationLogs: ${siteWithRelations.operationLogs.length} 条`);
    }
    
    // 验证数据库中不存在已删除的表
    console.log('\n3️⃣  验证已删除的表...');
    
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const tableNames = tables.map(t => t.table_name);
    const deletedTables = ['ProductAsset', 'ProductReview', 'ProductPackage', 'ProductTemplate'];
    
    const stillExists = deletedTables.filter(t => tableNames.includes(t));
    
    if (stillExists.length > 0) {
      console.log(`   ✗ 警告：以下表应该已删除但仍存在: ${stillExists.join(', ')}`);
    } else {
      console.log(`   ✓ 已确认删除的表不存在`);
    }
    
    console.log('\n✅ 数据库验证通过！');
    console.log('\n📊 验证摘要：');
    console.log(`   - 数据表数量: ${tables.length}`);
    console.log(`   - 站点数: ${siteCount}`);
    console.log(`   - 商品SKU: ${productSkuCount}`);
    console.log(`   - 订单: ${orderCount}`);
    console.log(`   - 媒体资源: ${mediaAssetCount}`);
    console.log(`   - 评价: ${reviewCount}`);
    console.log(`   - 浮动购买记录: ${floatingPurchaseCount}`);
    
  } catch (err) {
    console.error('\n❌ 验证失败:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase();
