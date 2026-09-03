import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始修复支付配置URL...');
  
  const result = await prisma.paymentSettings.updateMany({
    data: {
      notifyUrl: 'http://103.236.76.222:3001/api/payment/epay/notify',
      returnUrl: 'http://103.236.76.222:5173/payment/return',
    },
  });
  
  console.log(`✅ 已更新 ${result.count} 条记录`);
  
  // 验证更新结果
  const settings = await prisma.paymentSettings.findFirst();
  console.log('\n当前配置：');
  console.log('  notifyUrl:', settings?.notifyUrl);
  console.log('  returnUrl:', settings?.returnUrl);
}

main()
  .catch((e) => {
    console.error('❌ 更新失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
