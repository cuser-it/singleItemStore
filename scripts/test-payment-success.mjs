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

async function testPaymentSuccess() {
  console.log('测试支付成功页面配置...\n');

  try {
    // 获取活跃站点配置
    const settings = await prisma.siteSettings.findFirst({
      where: {
        site: {
          isActive: true,
        },
      },
      include: {
        site: true,
      },
    });

    if (!settings) {
      console.error('❌ 未找到活跃站点配置');
      return;
    }

    console.log('📌 活跃站点:', settings.site.name);
    console.log('📝 支付成功引导文案:', settings.paymentSuccessMessage);
    console.log('🔗 客服微信链接:', settings.customerServiceUrl || '(未配置)');
    console.log('\n---\n');

    // 测试不同类型的客服链接
    console.log('✅ 功能说明:');
    console.log('1. 如果 customerServiceUrl 为空，不显示二维码');
    console.log('2. 如果是微信直链 (weixin://)，生成二维码 + 显示"打开微信"按钮');
    console.log('3. 如果是图片URL (http:// 或 https://)，转换为base64显示');
    console.log('\n---\n');

    // 更新测试数据
    console.log('🧪 更新测试配置...');
    
    await prisma.siteSettings.update({
      where: { id: settings.id },
      data: {
        paymentSuccessMessage: '扫描下方二维码添加客服微信，领取产品使用说明',
        customerServiceUrl: 'weixin://dl/business/?t=example123456',
      },
    });

    console.log('✅ 测试配置已更新');
    console.log('\n访问测试页面: http://localhost:5173/payment/return\n');
    console.log('预期效果:');
    console.log('  - 显示骨架屏加载动画');
    console.log('  - 显示"购买成功！"标题');
    console.log('  - 显示自定义引导文案');
    console.log('  - 显示微信二维码（从 weixin:// 链接生成）');
    console.log('  - 显示绿色"打开微信添加客服"按钮');
    console.log('  - 显示"返回首页"按钮\n');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  }
}

testPaymentSuccess()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
