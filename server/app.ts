import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import cors from 'cors';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  defaultBootstrap,
  type FloatingPurchaseInput,
  type MediaAssetInput,
  type MediaSection,
  type ReviewInput,
  type SiteSettingsUpdateInput,
  mapBootstrapWithResolvedUrls,
  resolveMediaUrl,
  sortByOrder,
} from '../shared/site';
import { createMemoryStore, type ContentStore } from './store';

export type CreateAppOptions = {
  store?: ContentStore;
  adminPassword?: string;
  uploadDir?: string;
};

const jsonParser = express.json({ limit: '2mb' });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

function buildMediaInput(body: any): MediaAssetInput {
  return {
    section: pickSection(body.section),
    sourceType: body.sourceType === 'url' ? 'url' : 'upload',
    source: String(body.source ?? '').trim(),
    alt: String(body.alt ?? '').trim(),
    sortOrder: toNumber(body.sortOrder, 0),
    enabled: toBoolean(body.enabled, true),
  };
}

function buildReviewInput(body: any): ReviewInput {
  return {
    name: String(body.name ?? '').trim(),
    content: String(body.content ?? '').trim(),
    images: toStringArray(body.images),
    featuredOnHome: toBoolean(body.featuredOnHome, false),
    homeOrder: toNumber(body.homeOrder, 0),
    enabled: toBoolean(body.enabled, true),
  };
}

function buildFloatingPurchaseInput(body: any): FloatingPurchaseInput {
  return {
    content: String(body.content ?? '').trim(),
    enabled: toBoolean(body.enabled, true),
    sortOrder: toNumber(body.sortOrder, 0),
  };
}

function buildSettingsInput(body: any): SiteSettingsUpdateInput {
  return {
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
    salePrice: toNumber(body.salePrice, defaultBootstrap.settings.salePrice),
    originalPrice: toNumber(body.originalPrice, defaultBootstrap.settings.originalPrice),
    soldText: String(body.soldText ?? defaultBootstrap.settings.soldText).trim(),
    marqueeText: String(body.marqueeText ?? defaultBootstrap.settings.marqueeText).trim(),
    reviewTags: toStringArray(body.reviewTags, defaultBootstrap.settings.reviewTags),
    productVariants: Array.isArray(body.productVariants) ? body.productVariants : defaultBootstrap.settings.productVariants,
    heroImageCount: toNumber(body.heroImageCount, defaultBootstrap.settings.heroImageCount),
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

async function storeUpload(uploadDir: string, file: Express.Multer.File) {
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(file.originalname) || '.bin';
  const fileName = `${randomUUID()}${ext}`;
  const fullPath = path.join(uploadDir, fileName);
  await writeFile(fullPath, file.buffer);
  return `/img/${fileName}`;
}

async function listHeroOrDetail(store: ContentStore, section: MediaSection) {
  const assets = await store.listMediaAssets(section);
  return sortByOrder(assets.filter((item) => item.enabled)).map((item) => ({ ...item, resolvedUrl: resolveMediaUrl(item.source) }));
}

export async function createApp(options: CreateAppOptions = {}) {
  const store = options.store ?? (process.env.DATABASE_URL ? await import('./prismaStore').then((mod) => mod.createPrismaStore()) : createMemoryStore());
  const adminPassword = options.adminPassword ?? process.env.ADMIN_PASSWORD ?? 'admin123456';
  const uploadDir = options.uploadDir ?? path.resolve(process.cwd(), 'storage', 'img');
  const sessions = new Map<string, true>();
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(jsonParser);
  app.use('/img', express.static(uploadDir));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/public/bootstrap', async (_req, res) => {
    res.json(mapBootstrapWithResolvedUrls(await store.getBootstrap()));
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

  app.get('/api/admin/bootstrap', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json(await store.getAdminBootstrap());
  });

  app.put('/api/admin/site-settings', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json(await store.updateSiteSettings(buildSettingsInput(req.body)));
  });

  app.get('/api/admin/media-assets', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const section = req.query.section === 'detail' ? 'detail' : req.query.section === 'hero' ? 'hero' : undefined;
    res.json(await store.listMediaAssets(section));
  });

  app.post('/api/admin/media-assets', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.status(201).json(await store.createMediaAsset(buildMediaInput(req.body)));
  });

  app.put('/api/admin/media-assets/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const item = await store.updateMediaAsset(Number(req.params.id), buildMediaInput(req.body));
    if (!item) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(item);
  });

  app.delete('/api/admin/media-assets/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.status(await store.deleteMediaAsset(Number(req.params.id)) ? 204 : 404).end();
  });

  app.get('/api/admin/reviews', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json(await store.listReviews());
  });

  app.post('/api/admin/reviews', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.status(201).json(await store.createReview(buildReviewInput(req.body)));
  });

  app.put('/api/admin/reviews/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const item = await store.updateReview(Number(req.params.id), buildReviewInput(req.body));
    if (!item) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(item);
  });

  app.delete('/api/admin/reviews/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.status(await store.deleteReview(Number(req.params.id)) ? 204 : 404).end();
  });

  app.get('/api/admin/floating-purchases', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.json(await store.listFloatingPurchases());
  });

  app.post('/api/admin/floating-purchases', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.status(201).json(await store.createFloatingPurchase(buildFloatingPurchaseInput(req.body)));
  });

  app.put('/api/admin/floating-purchases/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    const item = await store.updateFloatingPurchase(Number(req.params.id), buildFloatingPurchaseInput(req.body));
    if (!item) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(item);
  });

  app.delete('/api/admin/floating-purchases/:id', async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    res.status(await store.deleteFloatingPurchase(Number(req.params.id)) ? 204 : 404).end();
  });

  app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
    if (!ensureAuthed(req, res, sessions)) return;
    if (!req.file) {
      res.status(400).json({ message: 'file required' });
      return;
    }
    const source = await storeUpload(uploadDir, req.file);
    res.status(201).json({ source, resolvedUrl: source });
  });

  return app;
}
