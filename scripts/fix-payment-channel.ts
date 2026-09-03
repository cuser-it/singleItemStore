/**
 * 修复数据库中错误的支付渠道值
 * 将 'wechat' 修正为 'wxpay'
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('检查数据库中的支付配置...\n');

  // 检查 PaymentSettings 表
  const settings = await prisma.paymentSettings.findMany({
    select: { id: true, siteId: true, enabledChannels: true },
  });

  console.log(`找到 ${settings.length} 条支付配置记录`);

  let fixedSettings = 0;
  for (const setting of settings) {
    const channels = setting.enabledChannels as string[];
    if (channels.includes('wechat')) {
      console.log(`\n⚠️  站点 ${setting.siteId} 的支付配置包含错误值 'wechat'`);
      console.log(`   当前值: ${JSON.stringify(channels)}`);
      
      const fixed = channels.map(ch => ch === 'wechat' ? 'wxpay' : ch);
      console.log(`   修正为: ${JSON.stringify(fixed)}`);
      
      await prisma.paymentSettings.update({
        where: { id: setting.id },
        data: { enabledChannels: fixed },
      });
      
      fixedSettings++;
      console.log('   ✅ 已修正');
    }
  }

  // 检查 Order 表
  const ordersWithWechat = await prisma.order.findMany({
    where: { paymentChannel: 'wechat' as any },
    select: { id: true, orderNo: true, paymentChannel: true },
  });

  console.log(`\n找到 ${ordersWithWechat.length} 个使用 'wechat' 的订单`);

  let fixedOrders = 0;
  for (const order of ordersWithWechat) {
    console.log(`\n⚠️  订单 ${order.orderNo} 使用了错误的支付渠道 'wechat'`);
    
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentChannel: 'wxpay' as any },
    });
    
    fixedOrders++;
    console.log('   ✅ 已修正为 wxpay');
  }

  console.log('\n=== 修复完成 ===');
  console.log(`修复了 ${fixedSettings} 条支付配置`);
  console.log(`修复了 ${fixedOrders} 个订单`);
  
  if (fixedSettings === 0 && fixedOrders === 0) {
    console.log('✅ 数据库中没有发现需要修复的数据');
  }
}

main()
  .catch((err) => {
    console.error('错误:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
