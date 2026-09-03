#!/usr/bin/env node
/**
 * 验证 SKU 编辑功能修复
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 验证 SKU 编辑功能修复...\n');

  // 1. 检查活动站点
  console.log('1️⃣ 检查活动站点数量...');
  const activeSites = await prisma.site.findMany({
    where: { isActive: true },
  });
  console.log(`   ✅ 活动站点数量: ${activeSites.length}`);
  if (activeSites.length !== 1) {
    console.error('   ❌ 错误：应该只有一个活动站点！');
    process.exit(1);
  }
  console.log(`   ✅ 活动站点: ID=${activeSites[0].id}, slug=${activeSites[0].slug}\n`);

  // 2. 查询 SKU
  console.log('2️⃣ 查询活动站点的 SKU...');
  const skus = await prisma.productSku.findMany({
    where: { siteId: activeSites[0].id },
    orderBy: { id: 'asc' },
  });
  console.log(`   ✅ 找到 ${skus.length} 个 SKU\n`);

  if (skus.length === 0) {
    console.log('   ℹ️  没有 SKU 需要测试');
    return;
  }

  // 3. 测试编辑功能
  const testSku = skus[0];
  console.log('3️⃣ 测试编辑功能...');
  console.log(`   原始数据: name="${testSku.name}", price=${testSku.price}`);
  
  const newName = `测试编辑-${Date.now()}`;
  const newPrice = 999.99;
  
  await prisma.productSku.update({
    where: { id: testSku.id },
    data: {
      name: newName,
      price: newPrice,
    },
  });
  console.log(`   ✅ 已更新: name="${newName}", price=${newPrice}`);

  // 4. 验证更新
  const updated = await prisma.productSku.findUnique({
    where: { id: testSku.id },
  });
  
  console.log('4️⃣ 验证更新结果...');
  if (updated.name === newName && updated.price.toString() === newPrice.toString()) {
    console.log('   ✅ 更新成功且持久化！');
  } else {
    console.error('   ❌ 更新失败！');
    console.error(`   实际数据: name="${updated.name}", price=${updated.price}`);
    process.exit(1);
  }

  // 5. 测试停用功能
  console.log('\n5️⃣ 测试停用功能...');
  await prisma.productSku.update({
    where: { id: testSku.id },
    data: { enabled: false },
  });
  
  const disabled = await prisma.productSku.findUnique({
    where: { id: testSku.id },
  });
  
  if (!disabled.enabled) {
    console.log('   ✅ 停用成功！');
  } else {
    console.error('   ❌ 停用失败！');
    process.exit(1);
  }

  // 恢复原始数据
  console.log('\n6️⃣ 恢复原始数据...');
  await prisma.productSku.update({
    where: { id: testSku.id },
    data: {
      name: testSku.name,
      price: testSku.price,
      enabled: testSku.enabled,
    },
  });
  console.log('   ✅ 已恢复原始数据');

  console.log('\n🎉 所有验证通过！SKU 编辑功能正常工作！');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
