import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import cors from 'cors';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  defaultBootstrap,
  type FloatingPurchaseInput,
  type MediaAssetInput,
  type MediaSection,
  type ReviewInput,
  type SiteInput,
  type SiteSettingsUpdateInput,
  type SiteUpdateInput,
  mapBootstrapWithResolvedUrls,
  resolveMediaUrl,
  sortByOrder,
} from '../shared/site';
import { createMemoryStore, type ContentStore } from './store';
import { createUploadStorageFromEnv, type UploadStorage } from './uploadStorage';
import { OrderService } from './orders';

export type CreateAppOptions = {
  store?: ContentStore;
  adminPassword?: string;
  uploadDir?: string;
  uploadStorage?: UploadStorage;
  /** 前端构建产物目录，默认 dist；目录不存在时不挂载静态服务 */
  staticDir?: string;
};

const jsonParser = express.json({ limit: '2mb' });
const maxUploadSizeMb = Math.max(1, Number(process.env.MAX_UPLOAD_SIZE_MB ?? 20));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadSizeMb * 1024 * 1024 } });

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function toStringArray(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((item) => item.trim()).filter(Boolean);
  }
  return fallback;
}

function pickSection(value: unknown): MediaSection {
  return value === 'detail' ? 'detail' : 'hero';
}

function buildSiteInput(body: any): SiteInput {
  return {
    name: String(body.name ?? '').trim(),
    slug: String(body.slug ?? '').trim(),
    templateSiteId: body.templateSiteId ? Number(body.templateSiteId) : undefined,
  };
}

function buildSiteUpdateInput(body: any): SiteUpdateInput {
  return {
    name: String(body.name ?? '').trim(),
    slug: String(body.slug ?? '').trim(),
  };
}

function buildMediaInput(body: any): { input: MediaAssetInput; siteId?: number } {
  return {
    input: {
      section: pickSection(body.section),
      sourceType: body.sourceType === 'url' ? 'url' : 'upload',
      source: String(body.source ?? '').trim(),
      alt: String(body.alt ?? '').trim(),
      sortOrder: toNumber(body.sortOrder, 0),
      enabled: toBoolean(body.enabled, true),
    },
    siteId: body.siteId ? Number(body.siteId) : undefined,
  };
}

function buildReviewInput(body: any): { input: ReviewInput; siteId?: number } {
  return {
    input: {
      name: String(body.name ?? '').trim(),
      content: String(body.content ?? '').trim(),
      images: toStringArray(body.images),
      featuredOnHome: toBoolean(body.featuredOnHome, false),
      homeOrder: toNumber(body.homeOrder, 0),
      enabled: toBoolean(body.enabled, true),
    },
    siteId: body.siteId ? Number(body.siteId) : undefined,
  };
}

function buildFloatingPurchaseInput(body: any): { input: FloatingPurchaseInput; siteId?: number } {
  return {
    input: {
      content: String(body.content ?? '').trim(),
      enabled: toBoolean(body.enabled, true),
      sortOrder: toNumber(body.sortOrder, 0),
    },
    siteId: body.siteId ? Number(body.siteId) : undefined,
  };
}

function buildSettingsInput(body: any): { input: SiteSettingsUpdateInput; siteId?: number } {
  return {
    input: {
      shopName: String(body.shopName ?? defaultBootstrap.settings.shopName).trim(),
      title: String(body.title ?? defaultBootstrap.settings.title).trim(),
      subtitle: String(body.subtitle ?? defaultBootstrap.settings.subtitle).trim(),
      highlight: String(body.highlight ?? defaultBootstrap.settings.highlight).trim(),
      serviceNote: String(body.serviceNote ?? defaultBootstrap.settings.serviceNote).trim(),
      guarantee: toStringArray(body.guarantee, defaultBootstrap.settings.guarantee),
      productDescription: String(body.productDescription ?? defaultBootstrap.settings.productDescription).trim(),
      shippingNote: String(body.shippingNote ?? defaultBootstrap.settings.shippingNote).trim(),
      reminder: String(body.reminder ?? defaultBootstrap.settings.reminder).trim(),
      shippingTime: String(body.shippingTime ?? defaultBootstrap.settings.shippingTime).trim(),
      soldText: String(body.soldText ?? defaultBootstrap.settings.soldText).trim(),
      marqueeText: String(body.marqueeText ?? defaultBootstrap.settings.marqueeText).trim(),
      reviewTags: toStringArray(body.reviewTags, defaultBootstrap.settings.reviewTags),
      heroImageCount: toNumber(body.heroImageCount, defaultBootstrap.settings.heroImageCount),
      // 支付成功页 / 客服引导配置
      paymentSuccessMessage: String(body.paymentSuccessMessage ?? '').trim() || defaultBootstrap.settings.paymentSuccessMessage,
      customerServiceUrl: String(body.customerServiceUrl ?? '').trim(),
      customerServiceQrCode: String(body.customerServiceQrCode ?? '').trim() || undefined,
    },
    siteId: body.siteId ? Number(body.siteId) : undefined,
  };
}

function ensureAuthed(req: Request, res: Response, sessions: Map<string, true>) {
  const token = req.cookies.admin_session as string | undefined;
  if (!token || !sessions.has(token)) {
    res.status(401).json({ message: 'unauthorized' });
    return false;
  }
  return true;
}

function createSafeUploadStorage(uploadDir: string, uploadStorage?: UploadStorage) {
  return uploadStorage ?? createUploadStorageFromEnv(process.env, uploadDir);
}

async function listHeroOrDetail(store: ContentStore, section: MediaSection) {
  const assets = await store.listMediaAssets(section);
  return sortByOrder(assets.filter((item) => item.enabled)).map((item) => ({ ...item, resolvedUrl: resolveMediaUrl(item.source) }));
}

function buildSkuInput(body: any) {
  return {
    skuCode: String(body.skuCode ?? '').trim(),
    name: String(body.name ?? '').trim(),
    subtitle: String(body.subtitle ?? '').trim(),
    price: String(body.price ?? '').trim(),
    originalPrice: String(body.originalPrice ?? body.price ?? '').trim(),
    saleLabel: String(body.saleLabel ?? '券后价').trim(),
    highlight: body.highlight ? String(body.highlight).trim() : undefined,
    enabled: toBoolean(body.enabled, true),
    sortOrder: toNumber(body.sortOrder, 0),
  };
}

/** 取用户发起请求的页面 Origin（优先 Origin 头，其次 Referer），用于生成与当前访问站点一致的支付返回地址 */
function resolveRequestOrigin(req: { headers: Record<string, string | string[] | undefined> }) {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin) return origin;
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function buildOrderInput(body: any) {
  return {
    siteId: body.siteId ? Number(body.siteId) : undefined,
    skuId: Number(body.skuId),
    quantity: Number(body.quantity),
    recipientName: String(body.recipientName ?? '').trim(),
    phone: String(body.phone ?? '').trim(),
    address: String(body.address ?? '').trim(),
    paymentChannel: body.paymentChannel === 'wxpay' ? 'wxpay' as const : 'alipay' as const,
    idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey) : undefined,
  };
}

function buildOrderFilters(query: any) {
  return {
    page: toNumber(query.page, 1),
    pageSize: toNumber(query.pageSize, 20),
    query: query.query ? String(query.query) : undefined,
    paymentStatus: query.paymentStatus ? String(query.paymentStatus) as any : undefined,
    fulfillmentStatus: query.fulfillmentStatus ? String(query.fulfillmentStatus) as any : undefined,
    refundStatus: query.refundStatus ? String(query.refundStatus) as any : undefined,
    deletedStatus: query.deletedStatus ? String(query.deletedStatus) as any : undefined,
    skuId: query.skuId ? Number(query.skuId) : undefined,
    startAt: query.startAt ? String(query.startAt) : undefined,
    endAt: query.endAt ? String(query.endAt) : undefined,
    siteId: query.siteId ? Number(query.siteId) : undefined,
  };
}

function buildPaymentSettingsInput(body: any) {
  return {
    gatewayUrl: String(body.gatewayUrl ?? '').trim(),
    merchantId: String(body.merchantId ?? '').trim(),
    merchantSecret: body.merchantSecret ? String(body.merchantSecret) : undefined,
    enabledChannels: Array.isArray(body.enabledChannels) ? body.enabledChannels : [],
    notifyUrl: String(body.notifyUrl ?? '').trim(),
    returnUrl: String(body.returnUrl ?? '').trim(),
    publicBaseUrl: String(body.publicBaseUrl ?? '').trim(),
  };
}

/**
 * 挂载前端构建产物：带 hash 的资源长缓存，index.html 不缓存，其余路径回退到 SPA 入口。
 * dist 不存在（开发、测试环境）时直接跳过，不影响现有行为。
 */
function mountStaticFrontend(app: express.Express, staticDir: string) {
  const indexHtml = path.join(staticDir, 'index.html');
  if (!existsSync(indexHtml)) return;
  app.use('/assets', express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(staticDir, { index: false }));
  // Express 5 不再支持 '*' 通配符路径，用正则排除 API / 上传目录后回退到 index.html
  app.get(/^\/(?!api\/|img\/|healthz$).*/, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}

export async function createApp(options: CreateAppOptions = {}) {
  const store: ContentStore = options.store ?? (process.env.DATABASE_URL ? await import('./prismaStore').then((mod) => mod.createPrismaStore()) : createMemoryStore());
  const adminPassword = options.adminPassword ?? process.env.ADMIN_PASSWORD ?? 'admin123456';
  const uploadDir = options.uploadDir ?? path.resolve(process.cwd(), 'storage', 'img');
  const uploadStorage = createSafeUploadStorage(uploadDir, options.uploadStorage);
  // 生产单端口部署：同一个进程同时提供 API 与前端构建产物（dist）
  const staticDir = options.staticDir ?? process.env.STATIC_DIR ?? path.resolve(process.cwd(), 'dist');
  const orderService = new OrderService(store);
  const sessions = new Map<string, true>();
  const publicBootstrapCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();
  const clearPublicBootstrapCache = () => publicBootstrapCache.clear();
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(jsonParser);
  app.use('/api/admin', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode < 400) clearPublicBootstrapCache();
      });
    }
    next();
  });
  app.use('/img', express.static(uploadDir));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/public/bootstrap', async (req, res) => {
    const slug = req.query.slug as string | undefined;
    const cacheKey = slug || '__default__';
    const cached = publicBootstrapCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(await cached.value);
    }

    const value = (async () => {
      let siteId: number | undefined;
      if (slug) {
        const site = await store.getSiteBySlug(slug);
        if (!site || !site.isActive) {
          const error = new Error('站点不存在或未启用') as Error & { status?: number };
          error.status = 404;
          throw error;
        }
        siteId = site.id;
      }

      const bootstrap = mapBootstrapWithResolvedUrls(await store.getBootstrap(siteId));
      return { ...bootstrap, skus: await orderService.listSkus(bootstrap.site.id, true) };
    })();

    publicBootstrapCache.set(cacheKey, { expiresAt: Date.now() + 30_000, value });

    try {
      res.setHeader('X-Cache', 'MISS');
      res.json(await value);
    } catch (error) {
      publicBootstrapCache.delete(cacheKey);
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : 'failed to load site' });
    }
  });

  app.get('/api/public/site', async (_req, res) => {
    res.json(await store.getSiteSettings());
  });

  app.get('/api/public/hero-images', async (_req, res) => {
    res.json(await listHeroOrDetail(store, 'hero'));
  });

  app.get('/api/public/detail-images', async (_req, res) => {
    res.json(await listHeroOrDetail(store, 'detail'));
  });

  app.get('/api/public/reviews', async (req, res) => {
    const limit = Math.max(1, toNumber(req.query.limit, 2));
    const bootstrap = await store.getBootstrap();
    res.json(bootstrap.reviews.slice(0, limit));
  });

  app.get('/api/public/reviews/all', async (_req, res) => {
    const bootstrap = await store.getBootstrap();
    res.json(bootstrap.allReviews);
  });

  app.get('/api/public/floating-purchases', async (_req, res) => {
    const bootstrap = await store.getBootstrap();
    res.json(bootstrap.floatingPurchases);
  });

  app.get('/api/public/skus', async (_req, res) => {
    res.json(await orderService.listSkus(undefined, true));
  });

  app.post('/api/public/orders', async (req, res) => {
    console.log('[DEBUG] POST /api/public/orders received, body:', req.body);
    try {
      res.status(201).json(await orderService.createOrder(buildOrderInput(req.body), resolveRequestOrigin(req)));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'order create failed' });
    }
  });

  app.get('/api/public/orders/:orderNo', async (req, res) => {
    try {
      const order = await orderService.queryPublicOrder(String(req.params.orderNo), String(req.query.phone ?? ''));
      if (!order) {
        res.status(404).json({ message: 'not found' });
        return;
      }
      res.json(order);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'order query failed' });
    }
  });

  app.get('/api/public/payment-success-config', async (req, res) => {
    try {
      res.json(await orderService.getPaymentSuccessConfig(req.query.orderNo ? String(req.query.orderNo) : undefined));
    } catch (error) {
      console.error('[payment-success-config] failed:', error);
      res.status(500).json({ message: 'failed to fetch config' });
    }
  });

  app.get('/api/payment/epay/notify', async (req, res) => {
    const result = await orderService.handleNotify(req.query as Record<string, string>);
    res.status(result.ok ? 200 : 400).send(result.ok ? 'success' : 'fail');
  });

  app.post('/api/payment/epay/notify', async (req, res) => {
    const result = await orderService.handleNotify(req.body as Record<string, string>);
    res.status(result.ok ? 200 : 400).send(result.ok ? 'success' : 'fail');
  });

  app.get('/api/payment/mock-notify/:orderNo', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    try {
      res.json(await orderService.mockNotifyParams(String(req.params.orderNo)));
    } catch {
      res.status(404).json({ message: 'not found' });
    }
  });

  app.post('/api/admin/login', async (req, res) => {
    const password = String(req.body?.password ?? '');
    if (password !== adminPassword) {
      res.status(401).json({ message: 'invalid password' });
      return;
    }

    const token = randomUUID();
    sessions.set(token, true);
    res.cookie('admin_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    const token = req.cookies.admin_session as string | undefined;
    if (token) {
      sessions.delete(token);
    }
    res.clearCookie('admin_session', { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/admin/me', (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json({ authenticated: true });
  });

  app.get('/api/admin/skus', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const siteId = req.query.siteId ? Number(req.query.siteId) : undefined;
    res.json(await orderService.listSkus(siteId));
  });

  app.post('/api/admin/skus', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    try {
      res.status(201).json(await orderService.createSku(buildSkuInput(req.body)));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'sku create failed' });
    }
  });

  app.put('/api/admin/skus/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    try {
      const sku = await orderService.updateSku(Number(req.params.id), buildSkuInput(req.body));
      if (!sku) {
        res.status(404).json({ message: 'not found' });
        return;
      }
      res.json(sku);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'sku update failed' });
    }
  });

  app.patch('/api/admin/skus/:id/enable', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.status(await orderService.enableSku(Number(req.params.id)) ? 204 : 404).end();
  });

  app.patch('/api/admin/skus/:id/disable', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.status(await orderService.disableSku(Number(req.params.id)) ? 204 : 404).end();
  });

  app.delete('/api/admin/skus/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.status(await orderService.deleteSku(Number(req.params.id)) ? 204 : 404).end();
  });

  app.get('/api/admin/orders/events', (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\\n\\n');
    orderService.addClient(res);
  });

  app.get('/api/admin/orders/export', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    try {
      const columns = req.query.columns ? String(req.query.columns).split(',') : [];
      const csv = await orderService.exportOrders(buildOrderFilters(req.query), columns);
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8');
      res.header('Content-Disposition', 'attachment; filename="orders.xlsx"');
      res.send(csv);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'export failed' });
    }
  });

  app.get('/api/admin/orders', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json(await orderService.listOrders(buildOrderFilters(req.query)));
  });

  app.get('/api/admin/orders/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const order = await orderService.getOrder(Number(req.params.id));
    if (!order) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json({ order, timeline: await orderService.getOrderTimeline(order.id) });
  });

  app.post('/api/admin/orders/:id/ship', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    try {
      const order = await orderService.shipOrder(Number(req.params.id), String(req.body?.logisticsCompany ?? ''), String(req.body?.logisticsNo ?? ''));
      if (!order) {
        res.status(404).json({ message: 'not found' });
        return;
      }
      res.json(order);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'ship failed' });
    }
  });

  app.post('/api/admin/orders/:id/refund-mark', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    try {
      const order = await orderService.markRefunded(Number(req.params.id), String(req.body?.refundNote ?? ''));
      if (!order) {
        res.status(404).json({ message: 'not found' });
        return;
      }
      res.json(order);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'refund mark failed' });
    }
  });

  app.delete('/api/admin/orders/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    try {
      const order = await orderService.deleteOrder(Number(req.params.id), String(req.body?.deletionReason ?? req.query.deletionReason ?? ''));
      if (!order) {
        res.status(404).json({ message: 'not found' });
        return;
      }
      res.json(order);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'delete failed' });
    }
  });

  app.get('/api/admin/payment-settings', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json(await orderService.getPaymentSettings());
  });

  app.put('/api/admin/payment-settings', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    try {
      res.json(await orderService.updatePaymentSettings(buildPaymentSettingsInput(req.body)));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'payment settings failed' });
    }
  });
  app.get('/api/admin/bootstrap', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const siteId = req.query.siteId ? Number(req.query.siteId) : undefined;
    res.json(await store.getAdminBootstrap(siteId));
  });

  app.get('/api/admin/sites', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json(await store.listSites());
  });

  app.post('/api/admin/sites', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    try {
      res.status(201).json(await store.createSite(buildSiteInput(req.body)));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'site create failed' });
    }
  });

  app.put('/api/admin/sites/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const site = await store.updateSite(Number(req.params.id), buildSiteUpdateInput(req.body));
    if (!site) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(site);
  });

  app.delete('/api/admin/sites/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const deleted = await store.deleteSite(Number(req.params.id));
    if (!deleted) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.status(204).end();
  });

  app.post('/api/admin/sites/:id/activate', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const site = await store.switchSite(Number(req.params.id));
    if (!site) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(site);
  });

  app.get('/api/admin/sites/:id/settings', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const siteId = Number(req.params.id);
    const settings = await store.getSiteSettings(siteId);
    if (!settings) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(settings);
  });

  app.put('/api/admin/site-settings', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const { input, siteId } = buildSettingsInput(req.body);
    const updated = await store.updateSiteSettings(input, siteId);
    await orderService.listSkus(updated.siteId);
    res.json(updated);
  });

  app.get('/api/admin/media-assets', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const section = req.query.section === 'detail' ? 'detail' : req.query.section === 'hero' ? 'hero' : undefined;
    res.json(await store.listMediaAssets(section));
  });

  app.post('/api/admin/media-assets', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const { input, siteId } = buildMediaInput(req.body);
    res.status(201).json(await store.createMediaAsset(input, siteId));
  });

  app.put('/api/admin/media-assets/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const { input, siteId } = buildMediaInput(req.body);
    const item = await store.updateMediaAsset(Number(req.params.id), input, siteId);
    if (!item) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(item);
  });

  app.delete('/api/admin/media-assets/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const siteId = req.query.siteId ? Number(req.query.siteId) : undefined;
    res.status(await store.deleteMediaAsset(Number(req.params.id), siteId) ? 204 : 404).end();
  });

  app.get('/api/admin/reviews', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json(await store.listReviews());
  });

  app.post('/api/admin/reviews', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const { input, siteId } = buildReviewInput(req.body);
    res.status(201).json(await store.createReview(input, siteId));
  });

  app.put('/api/admin/reviews/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const { input, siteId } = buildReviewInput(req.body);
    const item = await store.updateReview(Number(req.params.id), input, siteId);
    if (!item) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(item);
  });

  app.delete('/api/admin/reviews/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const siteId = req.query.siteId ? Number(req.query.siteId) : undefined;
    res.status(await store.deleteReview(Number(req.params.id), siteId) ? 204 : 404).end();
  });

  app.get('/api/admin/floating-purchases', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json(await store.listFloatingPurchases());
  });

  app.post('/api/admin/floating-purchases', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const { input, siteId } = buildFloatingPurchaseInput(req.body);
    res.status(201).json(await store.createFloatingPurchase(input, siteId));
  });

  app.put('/api/admin/floating-purchases/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const { input, siteId } = buildFloatingPurchaseInput(req.body);
    const item = await store.updateFloatingPurchase(Number(req.params.id), input, siteId);
    if (!item) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(item);
  });

  app.delete('/api/admin/floating-purchases/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const siteId = req.query.siteId ? Number(req.query.siteId) : undefined;
    res.status(await store.deleteFloatingPurchase(Number(req.params.id), siteId) ? 204 : 404).end();
  });

  app.post('/api/admin/upload', (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    upload.single('file')(req, res, async (error) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ message: `图片过大，请上传不超过 ${maxUploadSizeMb}MB 的文件` });
        return;
      }
      if (error) {
        res.status(400).json({ message: '图片上传失败，请重新选择文件' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: 'file required' });
        return;
      }
      try {
        res.status(201).json(await uploadStorage.save(req.file));
      } catch {
        res.status(502).json({ message: '图片存储失败，请检查存储桶配置或稍后重试' });
      }
    });
  });

  // 未匹配的 API 路径统一返回 JSON 404，避免前端拿到 HTML 后报 JSON 解析错误
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'not found' });
  });

  // 必须在所有 API 路由之后，否则 SPA 回退会抢先处理 /api 请求
  mountStaticFrontend(app, staticDir);

  return app;
}
