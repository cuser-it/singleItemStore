import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from './app';
import { createMemoryStore, defaultSiteSettings } from './store';
import type { SiteSettings } from '../shared/site';

const uploadDir = mkdtempSync(path.join(os.tmpdir(), 'single-item-store-upload-'));
let server: Server | null = null;
let baseUrl = '';
let authCookie = '';

async function startServer() {
  // 内存 store 的 SKU 由 settings.productVariants 在站点初始化时派生，
  // 默认配置里为空数组，会导致下单相关用例拿不到任何 SKU，这里显式播种一条
  const seedSettings: SiteSettings[] = [
    {
      ...defaultSiteSettings,
      id: 1,
      siteId: 1,
      productVariants: [{ id: 'single', name: '单盒体验装', subtitle: '先试用再决定', price: 99, originalPrice: 299, saleLabel: '券后价' }],
    },
  ];
  const app = await createApp({ store: createMemoryStore({ settings: seedSettings }), uploadDir, adminPassword: 'admin123456' });
  const httpServer = app.listen(0);
  await new Promise<void>((resolve) => httpServer.once('listening', resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind test server');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  return httpServer;
}

async function postJson<T>(pathName: string, body: unknown, cookie = authCookie) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) as T : undefined as T;
  return { response, data };
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

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await new Promise<void>((resolve) => (server as unknown as { close: (cb: () => void) => void }).close(() => resolve()));
  rmSync(uploadDir, { recursive: true, force: true });
});

describe('backend', () => {
  it('authenticates and protects admin endpoints', async () => {
    const denied = await fetch(`${baseUrl}/api/admin/me`);
    expect(denied.status).toBe(401);

    await login();

    const allowed = await fetch(`${baseUrl}/api/admin/me`, { headers: { cookie: authCookie } });
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toEqual({ authenticated: true });
  });
  it('deletes reviews from the active site', async () => {
    await login();

    const createResponse = await fetch(`${baseUrl}/api/admin/reviews`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '待删除评价',
        content: 'delete me',
        images: [],
        featuredOnHome: false,
        homeOrder: 0,
        enabled: true,
      }),
    });
    expect(createResponse.status).toBe(201);
    const review = (await createResponse.json()) as { id: number; name: string };

    const deleteResponse = await fetch(`${baseUrl}/api/admin/reviews/${review.id}`, {
      method: 'DELETE',
      headers: { cookie: authCookie },
    });
    expect(deleteResponse.status).toBe(204);

    const reviews = (await fetch(`${baseUrl}/api/admin/reviews`, { headers: { cookie: authCookie } }).then((response) => response.json())) as Array<{ id: number; name: string }>;
    expect(reviews.some((item) => item.id === review.id)).toBe(false);
  });

  it('stores uploaded media and preserves URL media and detail ordering', async () => {
    await login();

    const uploadForm = new FormData();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    uploadForm.append('file', new Blob([png], { type: 'image/png' }), 'hero.png');

    const uploadResponse = await fetch(`${baseUrl}/api/admin/upload`, {
      method: 'POST',
      headers: { cookie: authCookie },
      body: uploadForm,
    });
    expect(uploadResponse.status).toBe(201);
    const uploadResult = (await uploadResponse.json()) as { source: string; resolvedUrl: string };
    expect(uploadResult.source).toMatch(/^\/img\//);
    expect(uploadResult.resolvedUrl).toBe(uploadResult.source);

    // 将刚上传的文件挂为首页轮播图，才能验证“上传件会出现在公开 heroImages 里”
    const heroMediaResponse = await fetch(`${baseUrl}/api/admin/media-assets`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'hero',
        sourceType: 'upload',
        source: uploadResult.source,
        alt: 'hero-upload',
        sortOrder: 1,
        enabled: true,
      }),
    });
    expect(heroMediaResponse.status).toBe(201);

    const urlMediaResponse = await fetch(`${baseUrl}/api/admin/media-assets`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'detail',
        sourceType: 'url',
        source: 'https://example.com/detail-99.jpg',
        alt: 'detail-99',
        sortOrder: 99,
        enabled: true,
      }),
    });
    expect(urlMediaResponse.status).toBe(201);

    const publicBootstrap = await fetch(`${baseUrl}/api/public/bootstrap`).then((response) => response.json()) as {
      heroImages: Array<{ resolvedUrl: string; source: string }>;
      detailImages: Array<{ resolvedUrl: string; source: string; sortOrder: number }>;
      reviews: Array<unknown>;
    };

    expect(publicBootstrap.heroImages.some((item) => item.resolvedUrl.startsWith('/img/'))).toBe(true);
    expect(publicBootstrap.detailImages.at(-1)?.resolvedUrl).toBe('https://example.com/detail-99.jpg');
  });
  it('returns a clear 413 response when an upload is too large', async () => {
    await login();

    const uploadForm = new FormData();
    uploadForm.append('file', new Blob([new Uint8Array(21 * 1024 * 1024)], { type: 'image/jpeg' }), 'too-large.jpg');

    const uploadResponse = await fetch(`${baseUrl}/api/admin/upload`, {
      method: 'POST',
      headers: { cookie: authCookie },
      body: uploadForm,
    });

    expect(uploadResponse.status).toBe(413);
    await expect(uploadResponse.json()).resolves.toEqual({ message: '图片过大，请上传不超过 20MB 的文件' });
  });

  it('returns the newest reviews first and keeps the homepage list at two items', async () => {
    await login();

    await fetch(`${baseUrl}/api/admin/reviews`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '旧评论',
        content: 'older review',
        images: [],
        featuredOnHome: true,
        homeOrder: 10,
        enabled: true,
      }),
    });

    await fetch(`${baseUrl}/api/admin/reviews`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '新评论',
        content: 'newer review',
        images: [],
        featuredOnHome: true,
        homeOrder: 1,
        enabled: true,
      }),
    });

    const allReviews = (await fetch(`${baseUrl}/api/public/reviews/all`).then((response) => response.json())) as Array<{ name: string }>;
    expect(allReviews[0]?.name).toBe('新评论');

    const topReviews = (await fetch(`${baseUrl}/api/public/reviews?limit=2`).then((response) => response.json())) as Array<{ name: string }>;
    expect(topReviews).toHaveLength(2);
    expect(topReviews[0]?.name).toBe('新评论');

    await fetch(`${baseUrl}/api/admin/media-assets`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'detail',
        sourceType: 'url',
        source: 'https://example.com/detail-100.jpg',
        alt: 'detail-100',
        sortOrder: 100,
        enabled: true,
      }),
    });

    const detailImages = (await fetch(`${baseUrl}/api/public/detail-images`).then((response) => response.json())) as Array<{ sortOrder: number }>;
    const tail = detailImages.slice(-2).map((item) => item.sortOrder);
    expect(tail).toEqual([99, 100]);
  });
  it('copies a site template and keeps site content isolated for active slugs', async () => {
    await login();

    const createResponse = await fetch(`${baseUrl}/api/admin/sites`, {
      method: 'POST',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '第二站点', slug: 'second-site', templateSiteId: 1 }),
    });
    expect(createResponse.status).toBe(201);
    const createdSite = (await createResponse.json()) as { id: number; name: string; isActive: boolean };
    expect(createdSite.isActive).toBe(false);

    const activateResponse = await fetch(`${baseUrl}/api/admin/sites/${createdSite.id}/activate`, {
      method: 'POST',
      headers: { cookie: authCookie },
    });
    expect(activateResponse.status).toBe(200);
    await expect(activateResponse.json()).resolves.toMatchObject({ id: createdSite.id, isActive: true });

    const secondBootstrap = await fetch(`${baseUrl}/api/admin/bootstrap?siteId=${createdSite.id}`, { headers: { cookie: authCookie } }).then((response) => response.json()) as {
      activeSiteId: number;
      sites: Array<{ id: number; isActive: boolean }>;
      settings: { siteId: number; shopName: string };
      detailImages: Array<{ id: number; siteId: number; source: string }>;
    };
    expect(secondBootstrap.activeSiteId).toBe(createdSite.id);
    expect(secondBootstrap.sites.filter((site) => site.isActive).map((site) => site.id).sort((a, b) => a - b)).toEqual([1, createdSite.id]);
    expect(secondBootstrap.settings.siteId).toBe(createdSite.id);
    expect(secondBootstrap.detailImages.every((item) => item.siteId === createdSite.id)).toBe(true);

    const firstDetailId = secondBootstrap.detailImages[0]?.id;
    expect(firstDetailId).toBeTypeOf('number');
    // 当前有多个处于启用状态的站点，删除时必须显式指定 siteId，否则会落到另一个活动站点上
    await fetch(`${baseUrl}/api/admin/media-assets/${firstDetailId}?siteId=${createdSite.id}`, { method: 'DELETE', headers: { cookie: authCookie } });
    await fetch(`${baseUrl}/api/admin/site-settings`, {
      method: 'PUT',
      headers: { cookie: authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...defaultSettingsPayload(), siteId: createdSite.id, shopName: '第二站点店铺' }),
    });

    const secondPublic = await fetch(`${baseUrl}/api/public/bootstrap?slug=second-site`).then((response) => response.json()) as { settings: { siteId: number; shopName: string }; detailImages: Array<{ siteId: number }> };
    expect(secondPublic.settings.siteId).toBe(createdSite.id);
    expect(secondPublic.settings.shopName).toBe('第二站点店铺');
    expect(secondPublic.detailImages.every((item) => item.siteId === createdSite.id)).toBe(true);
    expect(secondPublic.detailImages.length).toBe(secondBootstrap.detailImages.length - 1);

    const firstBootstrap = await fetch(`${baseUrl}/api/admin/bootstrap?siteId=1`, { headers: { cookie: authCookie } }).then((response) => response.json()) as {
      activeSiteId: number;
      settings: { siteId: number; shopName: string };
      detailImages: Array<{ siteId: number }>;
    };
    expect(firstBootstrap.activeSiteId).toBe(1);
    expect(firstBootstrap.settings.shopName).not.toBe('第二站点店铺');
    expect(firstBootstrap.detailImages.every((item) => item.siteId === 1)).toBe(true);
    expect(firstBootstrap.detailImages.length).toBeGreaterThan(secondPublic.detailImages.length);
  });
  it('creates orders from enabled SKUs and handles payment notify idempotently', async () => {
    await login();

    const skus = await fetch(`${baseUrl}/api/admin/skus`, { headers: { cookie: authCookie } }).then((response) => response.json()) as Array<{ id: number; price: string }>;
    expect(skus.length).toBeGreaterThan(0);

    const payload = {
      skuId: skus[0].id,
      quantity: 2,
      recipientName: '测试用户',
      phone: '13800138000',
      address: '上海市测试路 1 号',
      paymentChannel: 'alipay',
      idempotencyKey: 'same-submit',
      ignoredPrice: '0.01',
    };
    const first = await postJson<{ order: { id: number; orderNo: string; totalAmount: string; paymentStatus: string }; paymentUrl: string; params?: Record<string, unknown> }>('/api/public/orders', payload, '');
    expect(first.response.status).toBe(201);
    expect(first.data.order.totalAmount).toBe((Number(skus[0].price) * 2).toFixed(2));
    expect(first.data.order.paymentStatus).toBe('PAYING');
    expect(first.data.paymentUrl).toContain(first.data.order.orderNo);
    expect(first.data.paymentUrl).not.toContain('sitename');
    expect(first.data.params).not.toHaveProperty('sitename');

    const second = await postJson<{ order: { id: number; orderNo: string } }>('/api/public/orders', payload, '');
    expect(second.data.order.id).toBe(first.data.order.id);

    const notifyParams = await fetch(`${baseUrl}/api/payment/mock-notify/${first.data.order.orderNo}`, { headers: { cookie: authCookie } }).then((response) => response.json()) as Record<string, string>;
    const notify = await fetch(`${baseUrl}/api/payment/epay/notify?${new URLSearchParams(notifyParams).toString()}`);
    expect(notify.status).toBe(200);
    await expect(notify.text()).resolves.toBe('success');

    const duplicate = await fetch(`${baseUrl}/api/payment/epay/notify?${new URLSearchParams(notifyParams).toString()}`);
    expect(duplicate.status).toBe(200);

    const orders = await fetch(`${baseUrl}/api/admin/orders?paymentStatus=PAID`, { headers: { cookie: authCookie } }).then((response) => response.json()) as { items: Array<{ id: number; paymentStatus: string }> };
    expect(orders.items.some((order) => order.id === first.data.order.id && order.paymentStatus === 'PAID')).toBe(true);
  });

  it('creates a new order when the same customer buys the same SKU again without an idempotency key', async () => {
    await login();

    const bootstrap = await fetch(`${baseUrl}/api/public/bootstrap`).then((response) => response.json()) as { site: { id: number }; skus: Array<{ id: number }> };
    const payload = {
      siteId: bootstrap.site.id,
      skuId: bootstrap.skus[0].id,
      quantity: 1,
      recipientName: '重复购买用户',
      phone: '13700137000',
      address: '广州市测试路 3 号',
      paymentChannel: 'wxpay',
    };

    const first = await postJson<{ order: { id: number; orderNo: string; paymentStatus: string } }>('/api/public/orders', payload, '');
    const second = await postJson<{ order: { id: number; orderNo: string; paymentStatus: string } }>('/api/public/orders', payload, '');

    expect(first.response.status).toBe(201);
    expect(second.response.status).toBe(201);
    expect(second.data.order.id).not.toBe(first.data.order.id);
    expect(second.data.order.orderNo).not.toBe(first.data.order.orderNo);
    expect(second.data.order.paymentStatus).toBe('PAYING');
  });

  it('caches public bootstrap reads and invalidates after admin writes', async () => {
    await login();

    const first = await fetch(`${baseUrl}/api/public/bootstrap`);
    const second = await fetch(`${baseUrl}/api/public/bootstrap`);
    expect(first.status).toBe(200);
    expect(second.headers.get('x-cache')).toBe('HIT');

    const sites = await fetch(`${baseUrl}/api/admin/sites`, { headers: { cookie: authCookie } }).then((response) => response.json()) as Array<{ id: number }>;
    const toggled = await fetch(`${baseUrl}/api/admin/sites/${sites[0].id}/activate`, { method: 'POST', headers: { cookie: authCookie } });
    expect(toggled.status).toBe(200);
    const restored = await fetch(`${baseUrl}/api/admin/sites/${sites[0].id}/activate`, { method: 'POST', headers: { cookie: authCookie } });
    expect(restored.status).toBe(200);

    const afterWrite = await fetch(`${baseUrl}/api/public/bootstrap`);
    expect(afterWrite.headers.get('x-cache')).toBe('MISS');
  });
  it('enforces shipping, refund marking, soft delete conditions, and export columns', async () => {
    await login();
    const skus = await fetch(`${baseUrl}/api/admin/skus`, { headers: { cookie: authCookie } }).then((response) => response.json()) as Array<{ id: number }>;
    const created = await postJson<{ order: { id: number } }>('/api/public/orders', { skuId: skus[0].id, quantity: 1, recipientName: '运营用户', phone: '13900139000', address: '北京市测试路 2 号', paymentChannel: 'wxpay' }, '');

    const badShip = await postJson(`/api/admin/orders/${created.data.order.id}/ship`, { logisticsCompany: '', logisticsNo: '' });
    expect(badShip.response.status).toBe(400);

    const shipped = await postJson<{ fulfillmentStatus: string }>(`/api/admin/orders/${created.data.order.id}/ship`, { logisticsCompany: '顺丰', logisticsNo: 'SF123' });
    expect(shipped.response.status).toBe(200);
    expect(shipped.data.fulfillmentStatus).toBe('SHIPPED');

    const earlyDelete = await fetch(`${baseUrl}/api/admin/orders/${created.data.order.id}`, { method: 'DELETE', headers: { cookie: authCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ deletionReason: '误删测试' }) });
    expect(earlyDelete.status).toBe(400);

    const noNote = await postJson(`/api/admin/orders/${created.data.order.id}/refund-mark`, { refundNote: '' });
    expect(noNote.response.status).toBe(400);

    const refunded = await postJson<{ paymentStatus: string }>(`/api/admin/orders/${created.data.order.id}/refund-mark`, { refundNote: '线下已退款' });
    expect(refunded.data.paymentStatus).toBe('REFUNDED');

    const deleted = await fetch(`${baseUrl}/api/admin/orders/${created.data.order.id}`, { method: 'DELETE', headers: { cookie: authCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ deletionReason: '已退款清理' }) });
    expect(deleted.status).toBe(200);

    const activeOrders = await fetch(`${baseUrl}/api/admin/orders`, { headers: { cookie: authCookie } }).then((response) => response.json()) as { items: Array<{ id: number }> };
    expect(activeOrders.items.some((order) => order.id === created.data.order.id)).toBe(false);

    const exportResponse = await fetch(`${baseUrl}/api/admin/orders/export?deletedStatus=all&columns=orderNo,recipientName,totalAmount`, { headers: { cookie: authCookie } });
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get('content-disposition')).toContain('orders.xlsx');
    const exported = new Uint8Array(await exportResponse.arrayBuffer());
    expect(Array.from(exported.slice(0, 2))).toEqual([80, 75]);
  });
});

function defaultSettingsPayload() {
  return {
    shopName: '单品商城 · 正品官方',
    title: '参茸 养心益肾胶囊 正品官方 勃起苦困难 阳痿早泄 OTC 国药准字',
    subtitle: '本品售出，非质量问题不退不换',
    highlight: '立赠1盒男士战斗礼包，中西结合更强更科学',
    serviceNote: '免费包邮 · 18:00 前下单承诺当日发出',
    guarantee: ['商城官方自营'],
    productDescription: '立赠1盒男士战斗礼包，中西结合更强更科学',
    shippingNote: '免费包邮',
    reminder: '正品保证，不仅全，而且更安全',
    shippingTime: '18:00 前下单，承诺当日发出',
    salePrice: 99,
    originalPrice: 299,
    soldText: '50000+已售',
    marqueeText: 'xxx购买',
    reviewTags: ['效果明显'],
    productVariants: [{ id: 'single', name: '单盒体验装', subtitle: '先试用再决定', price: 99, originalPrice: 299, saleLabel: '券后价' }],
    heroImageCount: 5,
  };
}
