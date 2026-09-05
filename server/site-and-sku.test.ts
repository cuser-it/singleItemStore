import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from './app';
import { createMemoryStore, defaultSiteSettings } from './store';
import type { SiteSettings } from '../shared/site';

/**
 * 本文件承接原先几个直连生产数据库的历史测试（active-site-uniqueness / site-creation /
 * sku-edit / payment-success）的有效意图，全部改为内存 store + 真实 HTTP 接口，
 * 不再依赖外部数据库或手动启动的 dev 服务器。
 */

const uploadDir = mkdtempSync(path.join(os.tmpdir(), 'site-sku-'));
let server: Server;
let baseUrl = '';
let cookie = '';

/** 内存 store 的 SKU 由 settings.productVariants 在站点初始化时派生，这里显式播种一条 */
function seededSettings(): SiteSettings[] {
  return [
    {
      ...defaultSiteSettings,
      id: 1,
      siteId: 1,
      productVariants: [
        { id: 'single', name: '单盒体验装', subtitle: '先试用再决定', price: 99, originalPrice: 299, saleLabel: '券后价' },
        { id: 'double', name: '双盒装', subtitle: '加量更划算', price: 178, originalPrice: 598, saleLabel: '券后价' },
      ],
    },
  ];
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
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(uploadDir, { recursive: true, force: true });
});

describe('站点 slug 路由', () => {
  it('按 slug 读取公开 bootstrap 应返回对应站点，而不是 500', async () => {
    // 回归：内存 store 曾漏实现 getSiteBySlug，导致 /api/public/bootstrap?slug=xxx 直接 500
    const response = await fetch(`${baseUrl}/api/public/bootstrap?slug=default`);
    expect(response.status).toBe(200);
    const bootstrap = (await response.json()) as { site: { id: number; slug: string }; settings: { siteId: number } };
    expect(bootstrap.site.slug).toBe('default');
    expect(bootstrap.settings.siteId).toBe(bootstrap.site.id);
  });

  it('slug 不存在时返回 404', async () => {
    const response = await fetch(`${baseUrl}/api/public/bootstrap?slug=not-exist`);
    expect(response.status).toBe(404);
  });
});

describe('站点启用状态', () => {
  it('启用新站点不会关闭其他已启用站点（多站点可同时在线）', async () => {
    const before = (await fetch(`${baseUrl}/api/admin/sites`, { headers: { cookie } }).then((r) => r.json())) as Array<{ id: number; isActive: boolean }>;
    const activeBefore = before.filter((site) => site.isActive).map((site) => site.id);
    expect(activeBefore.length).toBeGreaterThan(0);

    const created = (await fetch(`${baseUrl}/api/admin/sites`, {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '多活动站点测试', slug: 'multi-active', templateSiteId: 1 }),
    }).then((r) => r.json())) as { id: number; isActive: boolean };
    expect(created.isActive).toBe(false);

    const activated = await fetch(`${baseUrl}/api/admin/sites/${created.id}/activate`, { method: 'POST', headers: { cookie } });
    expect(activated.status).toBe(200);

    const after = (await fetch(`${baseUrl}/api/admin/sites`, { headers: { cookie } }).then((r) => r.json())) as Array<{ id: number; isActive: boolean }>;
    const activeAfter = after.filter((site) => site.isActive).map((site) => site.id).sort((a, b) => a - b);
    expect(activeAfter).toEqual([...activeBefore, created.id].sort((a, b) => a - b));
  });

  it('复制站点时会一并复制站点设置', async () => {
    const created = (await fetch(`${baseUrl}/api/admin/sites`, {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '复制站点', slug: 'copied-site', templateSiteId: 1 }),
    }).then((r) => r.json())) as { id: number };

    const settings = (await fetch(`${baseUrl}/api/admin/sites/${created.id}/settings`, { headers: { cookie } }).then((r) => r.json())) as SiteSettings;
    expect(settings.siteId).toBe(created.id);
    expect(settings.shopName).toBe(defaultSiteSettings.shopName);
    expect(settings.heroImageCount).toBe(defaultSiteSettings.heroImageCount);
  });
});

describe('SKU 管理接口', () => {
  it('SKU 由 productVariants 派生，且可通过接口编辑名称与价格', async () => {
    const skus = (await fetch(`${baseUrl}/api/admin/skus`, { headers: { cookie } }).then((r) => r.json())) as Array<{ id: number; skuCode: string; name: string; price: string }>;
    expect(skus.length).toBe(2);
    const target = skus[0];

    const updated = await fetch(`${baseUrl}/api/admin/skus/${target.id}`, {
      method: 'PUT',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...target, name: '编辑后的规格名称', price: '188.00' }),
    });
    expect(updated.status).toBe(200);
    const body = (await updated.json()) as { id: number; name: string; price: string };
    expect(body.name).toBe('编辑后的规格名称');
    expect(body.price).toBe('188.00');

    // 回归：编辑后重新读取列表，不应被 ensureSiteSkus 用 productVariants 覆盖回旧值
    const readBack = (await fetch(`${baseUrl}/api/admin/skus`, { headers: { cookie } }).then((r) => r.json())) as Array<{ id: number; name: string; price: string }>;
    const found = readBack.find((sku) => sku.id === target.id);
    expect(found?.name).toBe('编辑后的规格名称');
    expect(found?.price).toBe('188.00');
  });

  it('编辑不存在的 SKU 返回 404', async () => {
    const response = await fetch(`${baseUrl}/api/admin/skus/999999`, {
      method: 'PUT',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ skuCode: 'ghost', name: '不存在', price: '1.00', originalPrice: '2.00', saleLabel: '券后价', enabled: true, sortOrder: 1 }),
    });
    expect(response.status).toBe(404);
  });
});
