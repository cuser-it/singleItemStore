import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import * as XLSX from 'xlsx';
import { createApp } from './app';
import { createMemoryStore, defaultSiteSettings } from './store';
import type { SiteSettings } from '../shared/site';

const uploadDir = mkdtempSync(path.join(os.tmpdir(), 'order-export-'));
let server: Server;
let baseUrl = '';
let cookie = '';

function seededSettings(): SiteSettings[] {
  return [
    {
      ...defaultSiteSettings,
      id: 1,
      siteId: 1,
      productVariants: [{ id: 'single', name: '单盒体验装', subtitle: '先试用再决定', price: 99, originalPrice: 299, saleLabel: '券后价' }],
    },
  ];
}

async function createOrder(recipientName: string) {
  const skus = (await fetch(`${baseUrl}/api/admin/skus`, { headers: { cookie } }).then((r) => r.json())) as Array<{ id: number }>;
  const response = await fetch(`${baseUrl}/api/public/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      skuId: skus[0].id,
      quantity: 1,
      recipientName,
      phone: '13800138000',
      address: '测试地址',
      paymentChannel: 'alipay',
    }),
  });
  return (await response.json()) as { order: { id: number; orderNo: string } };
}

/** 读取导出的 xlsx，返回除表头外的数据行数与首列内容 */
function readSheet(buffer: ArrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  return { header: rows[0] ?? [], dataRows: rows.slice(1) };
}

beforeAll(async () => {
  const app = await createApp({ store: createMemoryStore({ settings: seededSettings() }), uploadDir, adminPassword: 'admin123456' });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('bind failed');
  baseUrl = `http://127.0.0.1:${address.port}`;
  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123456' }),
  });
  cookie = login.headers.get('set-cookie')!.split(';')[0];

  await createOrder('导出用户甲');
  await createOrder('导出用户乙');
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(uploadDir, { recursive: true, force: true });
});

describe('订单导出', () => {
  it('不带时间范围时，导出当前筛选下的全部订单', async () => {
    const response = await fetch(`${baseUrl}/api/admin/orders/export`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const { header, dataRows } = readSheet(await response.arrayBuffer());
    expect(header[0]).toBe('订单号');
    expect(dataRows.length).toBe(2);
  });

  it('时间范围会与列表筛选叠加：范围之外的订单不会被导出', async () => {
    // 这正是线上问题的成因：导出弹窗默认“近 24 小时”，把更早创建的订单静默排除掉了
    const farPast = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const alsoPast = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    const response = await fetch(`${baseUrl}/api/admin/orders/export?startAt=${farPast}&endAt=${alsoPast}`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const { header, dataRows } = readSheet(await response.arrayBuffer());
    expect(header.length).toBeGreaterThan(0);
    expect(dataRows.length).toBe(0);

    // 放宽到覆盖当下的时间范围后，订单应重新出现
    const now = new Date(Date.now() + 60 * 1000).toISOString();
    const wide = await fetch(`${baseUrl}/api/admin/orders/export?startAt=${farPast}&endAt=${now}`, { headers: { cookie } });
    expect(readSheet(await wide.arrayBuffer()).dataRows.length).toBe(2);
  });

  it('支付状态筛选会作用于导出结果', async () => {
    const paid = await fetch(`${baseUrl}/api/admin/orders/export?paymentStatus=PAID`, { headers: { cookie } });
    expect(readSheet(await paid.arrayBuffer()).dataRows.length).toBe(0);

    const paying = await fetch(`${baseUrl}/api/admin/orders/export?paymentStatus=PAYING`, { headers: { cookie } });
    expect(readSheet(await paying.arrayBuffer()).dataRows.length).toBe(2);
  });

  it('自定义导出列会体现在表头上', async () => {
    const response = await fetch(`${baseUrl}/api/admin/orders/export?columns=orderNo,phone`, { headers: { cookie } });
    const { header, dataRows } = readSheet(await response.arrayBuffer());
    expect(header).toEqual(['订单号', '手机号']);
    expect(dataRows.length).toBe(2);
    expect(dataRows[0]?.length).toBe(2);
  });

  it('非法导出列会被拒绝', async () => {
    const response = await fetch(`${baseUrl}/api/admin/orders/export?columns=orderNo,__proto__`, { headers: { cookie } });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('弹窗里可选的每一个字段服务端都支持（点“全选”不会导出失败）', async () => {
    // 回归：productName / unitAmount / paymentChannel / refundedAt 曾只存在于前端选项，
    // 服务端白名单里没有，导致用户点“全选”后导出直接报错
    const allColumns = ['orderNo', 'productName', 'skuName', 'quantity', 'unitAmount', 'totalAmount', 'recipientName', 'phone', 'address', 'paymentStatus', 'fulfillmentStatus', 'logisticsCompany', 'logisticsNo', 'paymentChannel', 'createdAt', 'paidAt', 'shippedAt', 'refundedAt', 'refundNote'];
    const response = await fetch(`${baseUrl}/api/admin/orders/export?columns=${allColumns.join(',')}`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const { header, dataRows } = readSheet(await response.arrayBuffer());
    expect(header.length).toBe(allColumns.length);
    expect(dataRows.length).toBe(2);
  });

  it('枚举与时间字段导出为中文/可读格式，而不是数据库原始值', async () => {
    const columns = ['paymentStatus', 'fulfillmentStatus', 'paymentChannel', 'createdAt', 'totalAmount', 'paidAt'];
    const response = await fetch(`${baseUrl}/api/admin/orders/export?columns=${columns.join(',')}`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const { header, dataRows } = readSheet(await response.arrayBuffer());
    expect(header).toEqual(['支付状态', '履约状态', '支付渠道', '创建时间', '成交金额', '支付时间']);
    const [row] = dataRows;
    expect(row[0]).toBe('支付中');
    expect(row[1]).toBe('待发货');
    expect(row[2]).toBe('支付宝');
    expect(row[3]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(row[4]).toMatch(/^\d+\.\d{2}$/);
    // 未支付订单的支付时间应为空字符串，而不是 undefined/null 字样
    expect(row[5] ?? '').toBe('');
  });
});
