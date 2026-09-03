import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from './app';
import { createMemoryStore } from './store';

const uploadDir = mkdtempSync(path.join(os.tmpdir(), 'single-item-store-settings-'));
let server: Server | null = null;
let baseUrl = '';
let authCookie = '';

async function startServer() {
  const app = await createApp({ store: createMemoryStore(), uploadDir, adminPassword: 'admin123456' });
  const httpServer = app.listen(0);
  await new Promise<void>((resolve) => httpServer.once('listening', resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind test server');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  return httpServer;
}

async function login() {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123456' }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie');
  if (!cookie) {
    throw new Error('expected auth cookie');
  }
  authCookie = cookie.split(';')[0];
}

describe('站点设置和 SKU 同步问题', () => {
  beforeAll(async () => {
    server = await startServer();
    await login();
  });

  afterAll(() => {
    server?.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  it('更新商品规格价格后，SKU 数据应该同步更新', async () => {
    // 1. 获取初始的站点设置
    const initialSettings = await fetch(`${baseUrl}/api/admin/bootstrap`, {
      headers: { cookie: authCookie },
    }).then((r) => r.json());
    
    expect(initialSettings.settings.productVariants[0].price).toBe(99);
    
    // 2. 获取初始的 SKU 列表
    const initialSkus = await fetch(`${baseUrl}/api/admin/skus`, {
      headers: { cookie: authCookie },
    }).then((r) => r.json());
    
    expect(initialSkus[0].price).toBe('99.00');
    
    // 3. 更新站点设置，修改第一个规格的价格
    const updatedSettings = {
      ...initialSettings.settings,
      productVariants: [
        { ...initialSettings.settings.productVariants[0], price: 88 },
        ...initialSettings.settings.productVariants.slice(1),
      ],
    };
    
    const updateRes = await fetch(`${baseUrl}/api/admin/site-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: authCookie },
      body: JSON.stringify(updatedSettings),
    });
    
    expect(updateRes.ok).toBe(true);
    const updatedResult = await updateRes.json();
    expect(updatedResult.productVariants[0].price).toBe(88);
    
    // 4. 验证 SKU 已同步更新
    const updatedSkus = await fetch(`${baseUrl}/api/admin/skus`, {
      headers: { cookie: authCookie },
    }).then((r) => r.json());
    
    expect(updatedSkus[0].price).toBe('88.00'); // 这里应该是 88.00 而不是 99.00
  });

  it('复制默认站点时，应该复制当前的数据而不是初始化数据', async () => {
    // 1. 修改默认站点的数据
    const initialBootstrap = await fetch(`${baseUrl}/api/admin/bootstrap`, {
      headers: { cookie: authCookie },
    }).then((r) => r.json());
    
    const modifiedSettings = {
      ...initialBootstrap.settings,
      shopName: '已修改的店铺名称',
      productVariants: [
        { ...initialBootstrap.settings.productVariants[0], price: 66 },
        ...initialBootstrap.settings.productVariants.slice(1),
      ],
    };
    
    await fetch(`${baseUrl}/api/admin/site-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: authCookie },
      body: JSON.stringify(modifiedSettings),
    });
    
    // 2. 创建新站点，复制默认站点（templateSiteId 未指定或为默认站点 ID）
    const defaultSiteId = initialBootstrap.site.id;
    const createRes = await fetch(`${baseUrl}/api/admin/sites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: authCookie },
      body: JSON.stringify({
        name: '新站点',
        slug: 'new-site',
        templateSiteId: defaultSiteId,
      }),
    });
    
    expect(createRes.ok).toBe(true);
    const newSite = await createRes.json();
    
    // 3. 激活新站点
    await fetch(`${baseUrl}/api/admin/sites/${newSite.id}/activate`, {
      method: 'POST',
      headers: { cookie: authCookie },
    });
    
    // 4. 获取新站点的设置
    const newSiteBootstrap = await fetch(`${baseUrl}/api/admin/bootstrap`, {
      headers: { cookie: authCookie },
    }).then((r) => r.json());
    
    // 5. 验证新站点复制的是修改后的数据
    expect(newSiteBootstrap.settings.shopName).toBe('已修改的店铺名称'); // 应该是修改后的名称
    expect(newSiteBootstrap.settings.productVariants[0].price).toBe(66); // 应该是修改后的价格
  });
});
