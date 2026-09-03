import { createRequire } from 'module';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 加载 .env.local（优先）和 .env
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config({ path: join(projectRoot, '.env') });

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
async function syncPaymentConfig() {
  console.log('同步支付配置到本地开发环境...\n');

  const activeSite = await prisma.site.findFirst({
    where: { isActive: true },
  });

  if (!activeSite) {
    console.log('❌ 未找到活跃站点');
    return;
  }

  console.log(`活跃站点: ${activeSite.name} (ID: ${activeSite.id})`);

  const paymentSettings = await prisma.paymentSettings.findUnique({
    where: { siteId: activeSite.id },
  });

  if (!paymentSettings) {
    console.log('❌ 未找到支付配置');
    return;
  }

  console.log('\n当前配置：');
  console.log(`  返回地址: ${paymentSettings.returnUrl}`);
  console.log(`  回调地址: ${paymentSettings.notifyUrl}`);

  // 读取环境变量
  const newReturnUrl = process.env.EPAY_RETURN_URL;
  const newNotifyUrl = process.env.EPAY_NOTIFY_URL;

  console.log('\n环境变量配置：');
  console.log(`  EPAY_RETURN_URL: ${newReturnUrl}`);
  console.log(`  EPAY_NOTIFY_URL: ${newNotifyUrl}`);

  if (paymentSettings.returnUrl === newReturnUrl && paymentSettings.notifyUrl === newNotifyUrl) {
    console.log('\n✅ 配置已是最新，无需更新');
    return;
  }

  console.log('\n正在更新数据库配置...');
  
  await prisma.paymentSettings.update({
    where: { siteId: activeSite.id },
    data: {
      returnUrl: newReturnUrl,
      notifyUrl: newNotifyUrl,
    },
  });

  console.log('✅ 配置已更新！');
  console.log('\n新配置：');
  console.log(`  返回地址: ${newReturnUrl}`);
  console.log(`  回调地址: ${newNotifyUrl}`);
}

syncPaymentConfig()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
