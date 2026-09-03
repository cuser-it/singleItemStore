#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups');
const timestamp = new Date().toISOString().split('T')[0];

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://user_MTYdSm:password_2CGeyC@103.236.76.222:5432/fsd'
    }
  }
});

async function exportData() {
  try {
    console.log('📋 开始导出关键表数据...\n');
    
    // 导出 ProductPackage (3条数据)
    console.log('1️⃣  导出 ProductPackage 表...');
    const productPackages = await prisma.$queryRaw`SELECT * FROM "ProductPackage"`;
    const packageFile = path.join(BACKUP_DIR, `ProductPackage_data_${timestamp}.json`);
    fs.writeFileSync(packageFile, JSON.stringify(productPackages, null, 2));
    console.log(`   ✓ 已导出 ${productPackages.length} 条记录到: ${packageFile}`);
    
    // 导出 ProductTemplate (1条数据)
    console.log('\n2️⃣  导出 ProductTemplate 表...');
    const productTemplates = await prisma.$queryRaw`SELECT * FROM "ProductTemplate"`;
    const templateFile = path.join(BACKUP_DIR, `ProductTemplate_data_${timestamp}.json`);
    fs.writeFileSync(templateFile, JSON.stringify(productTemplates, null, 2));
    console.log(`   ✓ 已导出 ${productTemplates.length} 条记录到: ${templateFile}`);
    
    // 打印数据预览
    console.log('\n📊 数据预览:');
    console.log('\n--- ProductPackage ---');
    productPackages.forEach((pkg, idx) => {
      console.log(`${idx + 1}. ID: ${pkg.id}, ${JSON.stringify(pkg).substring(0, 100)}...`);
    });
    
    console.log('\n--- ProductTemplate ---');
    productTemplates.forEach((tpl, idx) => {
      console.log(`${idx + 1}. ID: ${tpl.id}, ${JSON.stringify(tpl).substring(0, 100)}...`);
    });
    
    console.log('\n✅ 数据导出完成！');
    
  } catch (err) {
    console.error('❌ 导出失败:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
