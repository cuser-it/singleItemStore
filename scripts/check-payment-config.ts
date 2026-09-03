import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPaymentConfig() {
  console.log('检查支付配置...\n');

  // 获取当前活跃站点的支付设置
  const activeSite = await prisma.site.findFirst({
    where: { isActive: true },
  });

  if (!activeSite) {
    console.log('❌ 未找到活跃站点');
    return;
  }

  console.log(`✅ 活跃站点: ${activeSite.name} (ID: ${activeSite.id})`);

  const paymentSettings = await prisma.paymentSettings.findUnique({
    where: { siteId: activeSite.id },
  });

  if (!paymentSettings) {
    console.log('❌ 未找到支付配置');
    return;
  }

  console.log('\n支付配置信息：');
  console.log(`  网关地址: ${paymentSettings.gatewayUrl}`);
  console.log(`  商户号: ${paymentSettings.merchantId}`);
  console.log(`  回调地址: ${paymentSettings.notifyUrl}`);
  console.log(`  返回地址: ${paymentSettings.returnUrl}`);

  console.log('\n环境变量配置：');
  console.log(`  EPAY_RETURN_URL: ${process.env.EPAY_RETURN_URL}`);
  console.log(`  EPAY_NOTIFY_URL: ${process.env.EPAY_NOTIFY_URL}`);

  console.log('\n前端路由配置：');
  console.log(`  支付成功页面: /payment/return`);

  if (paymentSettings.returnUrl.includes('localhost')) {
    console.log('\n✅ 当前使用本地开发配置（localhost）');
  } else {
    console.log('\n⚠️  当前使用生产环境配置（服务器地址）');
    console.log('   如果你在本地开发，请确保已创建 .env.local 文件');
  }

  console.log('\n测试支付跳转：');
  const testOrderNo = 'SO20260903001001TEST';
  const testReturnUrl = `${paymentSettings.returnUrl}?orderNo=${testOrderNo}&trade_status=TRADE_SUCCESS`;
  console.log(`  模拟跳转地址: ${testReturnUrl}`);
}

checkPaymentConfig()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
