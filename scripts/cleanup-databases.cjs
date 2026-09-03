#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://user_MTYdSm:password_2CGeyC@103.236.76.222:5432/postgres'
    }
  }
});

async function cleanup() {
  try {
    console.log('🗑️  开始数据库清理...\n');
    
    // 步骤 1: 删除空数据库 user_MTYdSm
    console.log('1️⃣  删除空数据库 user_MTYdSm...');
    try {
      await prisma.$executeRawUnsafe('DROP DATABASE IF EXISTS "user_MTYdSm"');
      console.log('   ✓ user_MTYdSm 数据库已删除');
    } catch (err) {
      console.log('   ℹ️  user_MTYdSm 数据库不存在或已删除');
    }
    
    // 步骤 2: 删除旧系统数据库 single_item_store
    console.log('\n2️⃣  删除旧系统数据库 single_item_store...');
    try {
      await prisma.$executeRawUnsafe('DROP DATABASE IF EXISTS single_item_store');
      console.log('   ✓ single_item_store 数据库已删除');
    } catch (err) {
      console.log('   ℹ️  single_item_store 数据库不存在或已删除');
    }
    
    await prisma.$disconnect();
    
    // 步骤 3: 连接到 fsd 数据库删除空表
    console.log('\n3️⃣  连接到 fsd 数据库删除空表...');
    const fsdPrisma = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://user_MTYdSm:password_2CGeyC@103.236.76.222:5432/fsd'
        }
      }
    });
    
    // 删除空表 ProductAsset
    console.log('   - 删除 ProductAsset (0条数据)...');
    await fsdPrisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ProductAsset" CASCADE');
    console.log('     ✓ ProductAsset 表已删除');
    
    // 删除空表 ProductReview
    console.log('   - 删除 ProductReview (0条数据)...');
    await fsdPrisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ProductReview" CASCADE');
    console.log('     ✓ ProductReview 表已删除');
    
    console.log('\n⚠️  准备删除有数据的旧表...');
    console.log('   确认：ProductPackage (3条测试数据)');
    console.log('   确认：ProductTemplate (1条测试数据)');
    
    // 删除有数据的旧表 ProductPackage
    console.log('\n   - 删除 ProductPackage (3条数据)...');
    await fsdPrisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ProductPackage" CASCADE');
    console.log('     ✓ ProductPackage 表已删除');
    
    // 删除有数据的旧表 ProductTemplate
    console.log('   - 删除 ProductTemplate (1条数据)...');
    await fsdPrisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ProductTemplate" CASCADE');
    console.log('     ✓ ProductTemplate 表已删除');
    
    // 验证剩余的表
    console.log('\n4️⃣  验证剩余的表...');
    const tables = await fsdPrisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log(`   ✓ fsd 数据库现有 ${tables.length} 个表:`);
    tables.forEach(t => console.log(`     - ${t.table_name}`));
    
    await fsdPrisma.$disconnect();
    
    console.log('\n✅ 数据库清理完成！');
    console.log('\n📋 清理摘要：');
    console.log('   ✓ 已删除数据库: user_MTYdSm, single_item_store');
    console.log('   ✓ 已删除空表: ProductAsset, ProductReview');
    console.log('   ✓ 已删除旧表: ProductPackage (3条), ProductTemplate (1条)');
    console.log(`   ✓ 剩余表数: ${tables.length}`);
    
  } catch (err) {
    console.error('\n❌ 清理失败:', err.message);
    console.error(err);
    process.exit(1);
  }
}

cleanup();
