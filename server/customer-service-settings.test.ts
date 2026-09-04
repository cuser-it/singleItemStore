import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from './app';
import { createMemoryStore } from './store';

const uploadDir = mkdtempSync(path.join(os.tmpdir(), 'cs-settings-'));
let server: Server;
let baseUrl = '';
let cookie = '';

beforeAll(async () => {
  const app = await createApp({ store: createMemoryStore(), uploadDir, adminPassword: 'admin123456' });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('bind failed');
  baseUrl = `http://127.0.0.1:${address.port}`;
  const login = await fetch(`${baseUrl}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'admin123456' }) });
  cookie = login.headers.get('set-cookie')!.split(';')[0];
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(uploadDir, { recursive: true, force: true });
});

describe('客服二维码 / 客服链接 配置的保存与读取', () => {
  it('PUT /api/admin/site-settings 应保存三项客服配置，且 GET 与公开支付成功配置接口都能读到', async () => {
    const sites = await fetch(`${baseUrl}/api/admin/bootstrap`, { headers: { cookie } }).then((r) => r.json()) as { site: { id: number }; settings: Record<string, unknown> };
    const payload = {
      ...sites.settings,
      siteId: sites.site.id,
      paymentSuccessMessage: '加客服领取赠品',
      customerServiceUrl: 'https://work.weixin.qq.com/kfid/kfc123',
      customerServiceQrCode: '/img/qr-code.png',
    };
    const put = await fetch(`${baseUrl}/api/admin/site-settings`, { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    expect(put.status).toBe(200);
    const updated = await put.json();
    expect(updated.paymentSuccessMessage).toBe('加客服领取赠品');
    expect(updated.customerServiceUrl).toBe('https://work.weixin.qq.com/kfid/kfc123');
    expect(updated.customerServiceQrCode).toBe('/img/qr-code.png');

    const readBack = await fetch(`${baseUrl}/api/admin/sites/${sites.site.id}/settings`, { headers: { cookie } }).then((r) => r.json());
    expect(readBack.customerServiceUrl).toBe('https://work.weixin.qq.com/kfid/kfc123');
    expect(readBack.customerServiceQrCode).toBe('/img/qr-code.png');

    const publicConfig = await fetch(`${baseUrl}/api/public/payment-success-config`).then((r) => r.json());
    expect(publicConfig).toEqual({ message: '加客服领取赠品', customerServiceUrl: 'https://work.weixin.qq.com/kfid/kfc123', customerServiceQrCode: '/img/qr-code.png' });
  });

  it('清空二维码与链接后，公开接口返回空值（前台不显示客服按钮）', async () => {
    const sites = await fetch(`${baseUrl}/api/admin/bootstrap`, { headers: { cookie } }).then((r) => r.json()) as { site: { id: number }; settings: Record<string, unknown> };
    const put = await fetch(`${baseUrl}/api/admin/site-settings`, { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sites.settings, siteId: sites.site.id, customerServiceUrl: '  ', customerServiceQrCode: '' }) });
    expect(put.status).toBe(200);
    const publicConfig = await fetch(`${baseUrl}/api/public/payment-success-config`).then((r) => r.json());
    expect(publicConfig.customerServiceUrl).toBe('');
    expect(publicConfig.customerServiceQrCode).toBeUndefined();
  });
});
