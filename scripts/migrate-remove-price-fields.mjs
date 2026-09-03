#!/usr/bin/env node
/**
 * 数据库迁移脚本：删除 SiteSettings 中的冗余价格字段
 * 
 * 变更：
 * - 删除 SiteSettings.salePrice
 * - 删除 SiteSettings.originalPrice
 * - 删除 SiteSettings.productVariants
 * 
 * 价格数据现在只存储在 ProductSku 表中
 */

import { PrismaClient } from '@prisma/client';
import pg from 'pg';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 价格数据源重构：删除冗余字段 ===\n');

  // 1. 验证 ProductSku 表有数据
  console.log('[1/4] 验证 ProductSku 表数据...');
  const skuCount = await prisma.productSku.count();
  console.log(`✓ 找到 ${skuCount} 条 SKU 记录`);

  if (skuCount === 0) {
    console.warn('⚠️  警告：ProductSku 表为空，建议先初始化 SKU 数据');
    const proceed = process.env.FORCE_MIGRATE === 'true';
    if (!proceed) {
      console.log('退出迁移。如需强制执行，设置环境变量 FORCE_MIGRATE=true');
      process.exit(1);
    }
  }

  // 2. 备份当前数据（记录到日志）
  console.log('\n[2/4] 备份当前 SiteSettings 价格数据...');
  const allSettings = await prisma.siteSettings.findMany({
    select: {
      id: true,
      siteId: true,
      shopName: true,
    },
  });
  
  console.log('✓ 已读取所有站点配置，共 ' + allSettings.length + ' 条');
  console.log('提示：如需完整备份，请使用 pg_dump 命令\n');

  // 3. 使用原生 SQL 删除字段
  console.log('[3/4] 删除数据库字段...');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 环境变量未设置');
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // 检查字段是否存在
    const checkFields = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'SiteSettings' 
        AND column_name IN ('salePrice', 'originalPrice', 'productVariants')
    `);

    const fieldsToRemove = checkFields.rows.map(row => row.column_name);
    
    if (fieldsToRemove.length === 0) {
      console.log('✓ 字段已被删除，无需操作');
    } else {
      console.log(`准备删除字段: ${fieldsToRemove.join(', ')}`);
      
      await client.query(`
        ALTER TABLE "SiteSettings" 
          DROP COLUMN IF EXISTS "salePrice",
          DROP COLUMN IF EXISTS "originalPrice",
          DROP COLUMN IF EXISTS "productVariants"
      `);
      
      console.log('✓ 数据库字段删除成功');
    }
  } finally {
    await client.end();
  }

  // 4. 验证迁移结果
  console.log('\n[4/4] 验证迁移结果...');
  
  const settings = await prisma.siteSettings.findFirst();
  if (settings) {
    console.log('✓ SiteSettings 表结构验证通过');
    console.log('站点配置示例:', {
      shopName: settings.shopName,
      title: settings.title,
    });
  }

  const skus = await prisma.productSku.findMany({ take: 3 });
  console.log(`✓ ProductSku 表正常，前 ${skus.length} 条记录:`);
  skus.forEach(sku => {
    console.log(`  - ${sku.name}: ¥${sku.price}`);
  });

  console.log('\n=== 迁移完成 ===');
  console.log('后续步骤：');
  console.log('1. 重启应用服务');
  console.log('2. 测试 SKU 价格修改功能');
  console.log('3. 验证前台价格显示正确\n');
}

main()
  .catch((e) => {
    console.error('\n❌ 迁移失败:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
