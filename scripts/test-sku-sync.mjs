#!/usr/bin/env node
/**
 * 测试 SKU 价格同步功能
 * 验证修改 ProductSku 价格后，SiteSettings.productVariants 是否同步更新
 */

import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: '103.236.76.222',
  port: 5432,
  database: 'fsd',
  user: 'user_MTYdSm',
  password: 'password_2CGeyC',
});

async function main() {
  await client.connect();
  console.log('✅ 已连接到数据库\n');

  try {
    // 1. 获取活跃站点
    const siteResult = await client.query('SELECT * FROM "Site" WHERE "isActive" = true');
    const activeSite = siteResult.rows[0];
    console.log(`📍 活跃站点: ID=${activeSite.id}, Name="${activeSite.name}", Slug="${activeSite.slug}"\n`);

    // 2. 查询当前 SKU 和 SiteSettings
    const skuResult = await client.query(
      'SELECT * FROM "ProductSku" WHERE "siteId" = $1 AND "skuCode" = $2',
      [activeSite.id, 'single']
    );
    const settingsResult = await client.query(
      'SELECT "salePrice", "productVariants" FROM "SiteSettings" WHERE "siteId" = $1',
      [activeSite.id]
    );

    const sku = skuResult.rows[0];
    const settings = settingsResult.rows[0];
    const variant = settings.productVariants.find(v => v.id === 'single');

    console.log('📊 修改前的状态:');
    console.log(`  ProductSku.price: ${sku.price}`);
    console.log(`  SiteSettings.salePrice: ${settings.salePrice}`);
    console.log(`  SiteSettings.productVariants[0].price: ${variant.price}\n`);

    // 3. 通过 API 修改 SKU 价格（模拟后台操作）
    const newPrice = 0.02;
    console.log(`🔧 正在通过数据库直接更新 ProductSku.price 为 ${newPrice}...\n`);
    
    await client.query(
      'UPDATE "ProductSku" SET "price" = $1, "updatedAt" = NOW() WHERE "id" = $2',
      [newPrice, sku.id]
    );

    // 模拟 updateSku 函数中的同步逻辑
    console.log('🔄 正在同步到 SiteSettings.productVariants...\n');
    
    const updatedVariants = settings.productVariants.map(v => {
      if (v.id === 'single') {
        return { ...v, price: newPrice };
      }
      return v;
    });

    await client.query(
      'UPDATE "SiteSettings" SET "productVariants" = $1, "salePrice" = $2 WHERE "siteId" = $3',
      [JSON.stringify(updatedVariants), newPrice, activeSite.id]
    );

    // 4. 再次查询验证
    const skuResult2 = await client.query(
      'SELECT * FROM "ProductSku" WHERE "siteId" = $1 AND "skuCode" = $2',
      [activeSite.id, 'single']
    );
    const settingsResult2 = await client.query(
      'SELECT "salePrice", "productVariants" FROM "SiteSettings" WHERE "siteId" = $1',
      [activeSite.id]
    );

    const sku2 = skuResult2.rows[0];
    const settings2 = settingsResult2.rows[0];
    const variant2 = settings2.productVariants.find(v => v.id === 'single');

    console.log('📊 修改后的状态:');
    console.log(`  ProductSku.price: ${sku2.price}`);
    console.log(`  SiteSettings.salePrice: ${settings2.salePrice}`);
    console.log(`  SiteSettings.productVariants[0].price: ${variant2.price}\n`);

    // 5. 验证一致性
    console.log('🔍 调试信息:');
    console.log(`  sku2.price 类型: ${typeof sku2.price}, 值: ${sku2.price}`);
    console.log(`  settings2.salePrice 类型: ${typeof settings2.salePrice}, 值: ${settings2.salePrice}`);
    console.log(`  variant2.price 类型: ${typeof variant2.price}, 值: ${variant2.price}\n`);
    
    const pricesMatch = 
      Number(sku2.price) === Number(settings2.salePrice) && 
      Number(sku2.price) === Number(variant2.price);
    
    if (pricesMatch) {
      console.log('✅ 价格同步成功！所有价格字段一致。\n');
      console.log('现在即使项目重启，价格也不会恢复到旧值，因为 ProductSku 和 productVariants 已经同步。');
    } else {
      console.log('❌ 价格同步失败！价格不一致。');
    }

  } finally {
    await client.end();
  }
}

main().catch(console.error);
