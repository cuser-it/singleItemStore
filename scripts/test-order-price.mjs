#!/usr/bin/env node
/**
 * 测试订单创建流程，验证价格是否从数据库实时获取
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 测试订单价格获取流程...\n');

  // 1. 获取活动站点
  const activeSite = await prisma.site.findFirst({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });
  
  if (!activeSite) {
    console.error('❌ 没有找到活动站点');
    process.exit(1);
  }
  
  console.log(`1️⃣ 活动站点: ID=${activeSite.id}, slug=${activeSite.slug}`);

  // 2. 获取该站点的 SKU
  const skus = await prisma.productSku.findMany({
    where: { 
      siteId: activeSite.id,
      enabled: true,
    },
    orderBy: { id: 'asc' },
  });

  if (skus.length === 0) {
    console.error('❌ 没有找到可用的 SKU');
    process.exit(1);
  }

  const testSku = skus[0];
  console.log(`2️⃣ 测试 SKU: ID=${testSku.id}, name="${testSku.name}", price=${testSku.price}\n`);

  // 3. 模拟订单创建（查询 SKU 价格）
  console.log('3️⃣ 模拟订单创建流程...');
  
  // 这是后端 createOrder 中的逻辑
  const skuForOrder = await prisma.productSku.findUnique({
    where: { id: testSku.id },
  });

  if (!skuForOrder) {
    console.error('❌ SKU 不存在');
    process.exit(1);
  }

  const quantity = 2;
  const unitPriceCents = Math.round(parseFloat(skuForOrder.price.toString()) * 100);
  const totalCents = unitPriceCents * quantity;
  const unitAmount = (unitPriceCents / 100).toFixed(2);
  const totalAmount = (totalCents / 100).toFixed(2);

  console.log(`   📦 数量: ${quantity}`);
  console.log(`   💰 单价: ${unitAmount} 元`);
  console.log(`   💰 总价: ${totalAmount} 元`);

  // 4. 检查是否有最近的订单，看看价格是否正确
  console.log('\n4️⃣ 检查最近的订单...');
  const recentOrders = await prisma.order.findMany({
    where: { 
      siteId: activeSite.id,
      skuId: testSku.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  if (recentOrders.length === 0) {
    console.log('   ℹ️  没有找到订单');
  } else {
    console.log(`   找到 ${recentOrders.length} 个订单：`);
    recentOrders.forEach((order, index) => {
      console.log(`   ${index + 1}. 订单号: ${order.orderNo}`);
      console.log(`      单价: ${order.unitAmount} 元`);
      console.log(`      总价: ${order.totalAmount} 元`);
      console.log(`      创建时间: ${order.createdAt.toISOString()}`);
      console.log();
    });

    // 检查最新订单的价格是否与当前 SKU 价格一致
    const latestOrder = recentOrders[0];
    const latestOrderUnitPrice = parseFloat(latestOrder.unitAmount.toString());
    const currentSkuPrice = parseFloat(testSku.price.toString());

    console.log('5️⃣ 价格一致性检查：');
    console.log(`   当前 SKU 价格: ${currentSkuPrice} 元`);
    console.log(`   最新订单单价: ${latestOrderUnitPrice} 元`);
    
    if (latestOrderUnitPrice === currentSkuPrice) {
      console.log('   ✅ 价格一致！');
    } else {
      console.log('   ⚠️  价格不一致！这可能是因为：');
      console.log('      1. 订单创建后 SKU 价格被修改了（正常）');
      console.log('      2. 订单创建时使用了错误的价格（需要修复）');
    }
  }

  console.log('\n✅ 测试完成');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
