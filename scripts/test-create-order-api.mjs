#!/usr/bin/env node
/**
 * 通过 API 测试订单创建，验证价格是否正确
 */

const API_BASE = 'http://localhost:3001';

async function main() {
  console.log('🔍 测试通过 API 创建订单...\n');

  try {
    // 1. 获取站点配置
    console.log('1️⃣ 获取站点配置...');
    const siteRes = await fetch(`${API_BASE}/api/public/bootstrap`);
    if (!siteRes.ok) {
      throw new Error(`获取站点配置失败: ${siteRes.status}`);
    }
    const siteConfig = await siteRes.json();
    console.log(`   站点: ${siteConfig.site.title}`);
    console.log(`   SKU 数量: ${siteConfig.skus.length}`);
    
    // 打印所有 SKU 的价格
    console.log('\n2️⃣ 当前 SKU 价格：');
    siteConfig.skus.forEach(sku => {
      console.log(`   SKU ${sku.id}: ${sku.name} - ${sku.price} 元 (enabled: ${sku.enabled})`);
    });

    // 3. 使用第一个启用的 SKU 创建订单
    const testSku = siteConfig.skus.find(sku => sku.enabled);
    if (!testSku) {
      throw new Error('没有找到启用的 SKU');
    }

    console.log(`\n3️⃣ 使用 SKU ${testSku.id} 创建测试订单...`);
    console.log(`   SKU 名称: ${testSku.name}`);
    console.log(`   SKU 价格: ${testSku.price} 元`);

    const orderInput = {
      skuId: testSku.id,
      quantity: 1,
      recipientName: '测试用户',
      phone: '13800138000',
      address: '测试地址',
      paymentChannel: 'alipay',
      idempotencyKey: `test-${Date.now()}`,
    };

    console.log(`\n4️⃣ 提交订单请求...`);
    console.log(`   请求数据:`, JSON.stringify(orderInput, null, 2));

    const createRes = await fetch(`${API_BASE}/api/public/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderInput),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      throw new Error(`创建订单失败 (${createRes.status}): ${errorText}`);
    }

    const orderResult = await createRes.json();
    console.log(`\n5️⃣ 订单创建结果：`);
    console.log(`   订单号: ${orderResult.order.orderNo}`);
    console.log(`   单价: ${orderResult.order.unitAmount} 元`);
    console.log(`   数量: ${orderResult.order.quantity}`);
    console.log(`   总价: ${orderResult.order.totalAmount} 元`);
    console.log(`   SKU ID: ${orderResult.order.skuId}`);
    console.log(`   SKU 名称: ${orderResult.order.skuName}`);

    // 比较价格
    console.log(`\n6️⃣ 价格比较：`);
    console.log(`   SKU 配置价格: ${testSku.price} 元`);
    console.log(`   订单单价: ${orderResult.order.unitAmount} 元`);
    
    if (testSku.price === orderResult.order.unitAmount) {
      console.log('   ✅ 价格一致！');
    } else {
      console.log('   ❌ 价格不一致！订单价格错误！');
      console.log(`\n🐛 BUG 确认：`);
      console.log(`   期望价格: ${testSku.price} 元`);
      console.log(`   实际价格: ${orderResult.order.unitAmount} 元`);
      console.log(`   差异: ${(parseFloat(orderResult.order.unitAmount) - parseFloat(testSku.price)).toFixed(2)} 元`);
    }

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    if (error.cause) {
      console.error('   原因:', error.cause);
    }
    process.exit(1);
  }

  console.log('\n✅ 测试完成');
}

main();
