#!/usr/bin/env node
/**
 * 本地模拟支付回调 —— 把指定订单置为已支付。
 *
 * 背景：notify_url 是「支付网关的服务器」主动请求的地址，本地开发时网关根本
 * 连不到你的机器，所以支付成功后订单仍停留在「支付中」。本地验证回调链路
 * 用这个脚本即可，无需真实支付、也无需内网穿透。
 *
 * 用法：
 *   node scripts/mock-notify.mjs SOTEST0002
 *   node scripts/mock-notify.mjs SOTEST0002 --base http://localhost:3001
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const orderNo = args.find((arg) => !arg.startsWith('--'));
const baseIndex = args.indexOf('--base');
const baseUrl = (baseIndex >= 0 ? args[baseIndex + 1] : process.env.API_BASE) || 'http://localhost:3001';

if (!orderNo) {
  console.error('用法: node scripts/mock-notify.mjs <订单号> [--base http://localhost:3001]');
  process.exit(1);
}

function readAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  try {
    const env = readFileSync(path.join(rootDir, '.env'), 'utf8');
    const line = env.split('\n').find((item) => item.startsWith('ADMIN_PASSWORD='));
    if (line) return line.slice('ADMIN_PASSWORD='.length).trim().replace(/^["']|["']$/g, '');
  } catch {
    // 忽略，下面统一报错
  }
  return '';
}

async function main() {
  const password = readAdminPassword();
  if (!password) throw new Error('未找到 ADMIN_PASSWORD（请设置环境变量或写入 .env）');

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!login.ok) throw new Error(`登录失败: HTTP ${login.status}`);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('登录成功但未取得会话 Cookie');

  // 让服务端按当前商户密钥算出正确签名，避免手工拼签名出错
  const paramsResponse = await fetch(`${baseUrl}/api/payment/mock-notify/${encodeURIComponent(orderNo)}`, { headers: { cookie } });
  if (!paramsResponse.ok) throw new Error(`订单不存在或无法生成回调参数: HTTP ${paramsResponse.status}`);
  const params = await paramsResponse.json();

  const query = new URLSearchParams(params).toString();
  const notify = await fetch(`${baseUrl}/api/payment/epay/notify?${query}`);
  const text = (await notify.text()).trim();

  if (notify.ok && text === 'success') {
    console.log(`✅ 订单 ${orderNo} 回调成功，已置为「已支付」（交易号 ${params.trade_no}）`);
    console.log('   刷新后台「订单管理」即可看到状态变化。');
  } else {
    console.error(`❌ 回调被拒绝: HTTP ${notify.status} ${text}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
