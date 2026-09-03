import { createRequire } from 'module';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config({ path: join(projectRoot, '.env') });

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addCustomerServiceUrl() {
  console.log('添加客服微信链接字段...\n');

  try {
    // 检查字段是否已存在
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'SiteSettings' 
      AND column_name = 'customerServiceUrl'
    `;

    if (result.length > 0) {
      console.log('✅ customerServiceUrl 字段已存在');
      return;
    }

    // 添加字段
    await prisma.$executeRaw`
      ALTER TABLE "SiteSettings" 
      ADD COLUMN "customerServiceUrl" TEXT NOT NULL DEFAULT ''
    `;

    console.log('✅ 成功添加 customerServiceUrl 字段');
    
    // 验证字段
    const sites = await prisma.siteSettings.findMany({
      select: {
        id: true,
        siteId: true,
        customerServiceUrl: true,
      },
    });

    console.log(`\n已更新 ${sites.length} 条记录，默认值为空字符串`);
    
  } catch (error) {
    console.error('❌ 添加字段失败:', error);
    throw error;
  }
}

addCustomerServiceUrl()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
