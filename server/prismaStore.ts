import { PrismaClient, Prisma } from '@prisma/client';
import {
  defaultBootstrap,
  defaultSiteSettings,
  type FloatingPurchase,
  type FloatingPurchaseInput,
  type MediaAsset,
  type MediaAssetInput,
  type MediaSection,
  type PublicBootstrap,
  type Review,
  type ReviewInput,
  type Site,
  type SiteInput,
  type SiteSettings,
  type SiteSettingsUpdateInput,
  type SiteUpdateInput,
  resolveMediaUrl,
} from '../shared/site';
import type { ContentStore } from './store';
import { ContentValidationError, validateDisplayDate, validateMediaWrite, validateMediaModeWrite } from '../shared/contentValidation';

const client = new PrismaClient();
const DEFAULT_SITE_ID = 1;

function toStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || `site-${Date.now()}`;
}
function normalizeDisplayDate(value: string | null | undefined) {
  validateDisplayDate(value);
  return value === undefined ? undefined : value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

function mapSite(record: { id: number; name: string; slug: string; isActive: boolean; createdAt: Date; updatedAt: Date }): Site {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapSettings(record: {
  id: number;
  siteId: number;
  shopName: string;
  title: string;
  subtitle: string;
  highlight: string;
  serviceNote: string;
  guarantee: Prisma.JsonValue;
  productDescription: string;
  shippingNote: string;
  reminder: string;
  shippingTime: string;
  salePrice: number;
  originalPrice: number;
  soldText: string;
  marqueeText: string;
  reviewTags: Prisma.JsonValue;
  productVariants: Prisma.JsonValue;
  heroImageCount: number;
  heroMediaMode?: string | null;
  paymentSuccessMessage?: string | null;
  customerServiceUrl?: string | null;
  customerServiceQrCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SiteSettings {
  return {
    id: record.id,
    siteId: record.siteId,
    shopName: record.shopName,
    title: record.title,
    subtitle: record.subtitle,
    highlight: record.highlight,
    serviceNote: record.serviceNote,
    guarantee: toStringArray(record.guarantee),
    productDescription: record.productDescription,
    shippingNote: record.shippingNote,
    reminder: record.reminder,
    shippingTime: record.shippingTime,
    salePrice: record.salePrice,
    originalPrice: record.originalPrice,
    soldText: record.soldText,
    marqueeText: record.marqueeText,
    reviewTags: toStringArray(record.reviewTags),
    productVariants: Array.isArray(record.productVariants) ? (record.productVariants as SiteSettings['productVariants']) : [],
    heroImageCount: record.heroImageCount,
    heroMediaMode: record.heroMediaMode === 'video' ? 'video' : 'image',
    paymentSuccessMessage: record.paymentSuccessMessage || defaultBootstrap.settings.paymentSuccessMessage,
    customerServiceUrl: record.customerServiceUrl ?? '',
    customerServiceQrCode: record.customerServiceQrCode || undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
async function verifyDatabaseStructure() {
  const db = await client.$queryRawUnsafe<Array<{ database: string; schema: string; table_name: string | null }>>(`SELECT current_database() AS database, current_schema() AS schema, to_regclass($1)::text AS table_name`, '"Site"');
  if (db[0]?.database !== 'fsd') throw new Error(`Refusing to initialize database ${db[0]?.database ?? 'unknown'}; DATABASE_URL must point to fsd`);
  const required = ['Site', 'SiteSettings', 'MediaAsset', 'Review', 'FloatingPurchase', 'ProductSku', 'Order', 'OperationLog'];
  const rows = await client.$queryRawUnsafe<Array<{ table_name: string | null }>>(`SELECT to_regclass(x)::text AS table_name FROM unnest($1::text[]) AS x`, required.map((name) => `"${name}"`));
  const present = rows.filter((row) => row.table_name).length;
  if (present > 0 && present < required.length) {
    const missing = rows.map((row, index) => row.table_name ? null : required[index]).filter(Boolean);
    throw new Error(`Database fsd has an incomplete schema; missing tables: ${missing.join(', ')}. Run npx prisma migrate deploy.`);
  }
  if (present === required.length) return false;
  return true;
}

function requiredSchemaColumns() {
  return ['SiteSettings.heroMediaMode', 'MediaAsset.kind', 'MediaAsset.posterSource', 'Review.displayDate'];
}
function mapMediaAsset(record: {
  id: number;
  siteId: number;
  section: string;
  sourceType: string;
  kind?: string | null;
  posterSource?: string | null;
  source: string;
  alt: string;
  sortOrder: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): MediaAsset {
  return {
    id: record.id,
    siteId: record.siteId,
    section: record.section as MediaSection,
    sourceType: record.sourceType as MediaAsset['sourceType'],
    kind: (record.kind || 'image') as MediaAsset['kind'],
    posterSource: record.posterSource ?? null,
    source: record.source,
    alt: record.alt,
    sortOrder: record.sortOrder,
    enabled: record.enabled,
    resolvedUrl: resolveMediaUrl(record.source),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapReview(record: {
  displayDate?: Date | null;
  id: number;
  siteId: number;
  name: string;
  content: string;
  images: Prisma.JsonValue;
  featuredOnHome: boolean;
  homeOrder: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Review {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    content: record.content,
    images: toStringArray(record.images),
    displayDate: record.displayDate?.toISOString().slice(0, 10) ?? null,
    featuredOnHome: record.featuredOnHome,
    homeOrder: record.homeOrder,
    enabled: record.enabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapFloatingPurchase(record: {
  id: number;
  siteId: number;
  content: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): FloatingPurchase {
  return {
    id: record.id,
    siteId: record.siteId,
    content: record.content,
    enabled: record.enabled,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function ensureSchema() {
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Site" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "isActive" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SiteSettings" (
      "id" SERIAL PRIMARY KEY,
      "siteId" INTEGER NOT NULL UNIQUE,
      "shopName" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "subtitle" TEXT NOT NULL,
      "highlight" TEXT NOT NULL,
      "serviceNote" TEXT NOT NULL,
      "guarantee" JSONB NOT NULL,
      "productDescription" TEXT NOT NULL,
      "shippingNote" TEXT NOT NULL,
      "reminder" TEXT NOT NULL,
      "shippingTime" TEXT NOT NULL,
      "salePrice" DOUBLE PRECISION NOT NULL,
      "originalPrice" DOUBLE PRECISION NOT NULL,
      "soldText" TEXT NOT NULL,
      "marqueeText" TEXT NOT NULL,
      "reviewTags" JSONB NOT NULL,
      "productVariants" JSONB NOT NULL,
      "heroImageCount" INTEGER NOT NULL,
      "heroMediaMode" TEXT NOT NULL DEFAULT 'image',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MediaAsset" (
      "id" SERIAL PRIMARY KEY,
      "siteId" INTEGER NOT NULL DEFAULT 1,
      "section" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      "kind" TEXT NOT NULL DEFAULT 'image',
      "posterSource" TEXT,
      "source" TEXT NOT NULL,
      "alt" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Review" (
      "id" SERIAL PRIMARY KEY,
      "siteId" INTEGER NOT NULL DEFAULT 1,
      "name" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "images" JSONB NOT NULL,
      "featuredOnHome" BOOLEAN NOT NULL DEFAULT FALSE,
      "homeOrder" INTEGER NOT NULL DEFAULT 0,
      "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FloatingPurchase" (
      "id" SERIAL PRIMARY KEY,
      "siteId" INTEGER NOT NULL DEFAULT 1,
      "content" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.$executeRawUnsafe('ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "heroMediaMode" TEXT NOT NULL DEFAULT \'image\'');
  await client.$executeRawUnsafe('ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT \'image\'');
  await client.$executeRawUnsafe('ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "posterSource" TEXT');
  await client.$executeRawUnsafe('ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "displayDate" DATE');

  await client.$executeRawUnsafe('ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "siteId" INTEGER DEFAULT 1');
  await client.$executeRawUnsafe('ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "siteId" INTEGER DEFAULT 1');
  await client.$executeRawUnsafe('ALTER TABLE "FloatingPurchase" ADD COLUMN IF NOT EXISTS "siteId" INTEGER DEFAULT 1');
  await client.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Site_slug_key" ON "Site" ("slug")');
  await client.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "SiteSettings_siteId_key" ON "SiteSettings" ("siteId")');
  await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MediaAsset_siteId_section_idx" ON "MediaAsset" ("siteId", "section")');
  await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Review_siteId_idx" ON "Review" ("siteId")');
  await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "FloatingPurchase_siteId_idx" ON "FloatingPurchase" ("siteId")');
}

async function ensureSeed() {
  const shouldInitialize = await verifyDatabaseStructure();
  if (shouldInitialize) await ensureSchema();

  // 默认站点只在首次创建时激活；已有活动站点时不改变其他站点状态
  const hasActiveSite = (await client.site.count({ where: { isActive: true } })) > 0;
  const defaultSite = await client.site.upsert({
    where: { slug: defaultBootstrap.site.slug },
    update: { name: defaultBootstrap.site.name },
    create: { id: DEFAULT_SITE_ID, name: defaultBootstrap.site.name, slug: defaultBootstrap.site.slug, isActive: !hasActiveSite },
  });
  await client.$executeRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"Site"\', \'id\'), COALESCE((SELECT MAX("id") FROM "Site"), 1))');
  await client.$executeRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"SiteSettings"\', \'id\'), COALESCE((SELECT MAX("id") FROM "SiteSettings"), 1))');

  await client.$executeRawUnsafe(`UPDATE "SiteSettings" SET "siteId" = ${defaultSite.id} WHERE "siteId" IS NULL`);
  await client.$executeRawUnsafe(`UPDATE "MediaAsset" SET "siteId" = ${defaultSite.id} WHERE "siteId" IS NULL`);
  await client.$executeRawUnsafe(`UPDATE "Review" SET "siteId" = ${defaultSite.id} WHERE "siteId" IS NULL`);
  await client.$executeRawUnsafe(`UPDATE "FloatingPurchase" SET "siteId" = ${defaultSite.id} WHERE "siteId" IS NULL`);

  const existingSettings = await client.siteSettings.findUnique({ where: { siteId: defaultSite.id } });
  if (!existingSettings) {
    await client.siteSettings.create({
      data: {
        siteId: defaultSite.id,
        shopName: defaultBootstrap.settings.shopName,
        title: defaultBootstrap.settings.title,
        subtitle: defaultBootstrap.settings.subtitle,
        highlight: defaultBootstrap.settings.highlight,
        serviceNote: defaultBootstrap.settings.serviceNote,
        guarantee: toJsonValue(defaultBootstrap.settings.guarantee),
        productDescription: defaultBootstrap.settings.productDescription,
        shippingNote: defaultBootstrap.settings.shippingNote,
        reminder: defaultBootstrap.settings.reminder,
        shippingTime: defaultBootstrap.settings.shippingTime,
        salePrice: defaultBootstrap.settings.salePrice,
        originalPrice: defaultBootstrap.settings.originalPrice,
        soldText: defaultBootstrap.settings.soldText,
        marqueeText: defaultBootstrap.settings.marqueeText,
        reviewTags: toJsonValue(defaultBootstrap.settings.reviewTags),
        productVariants: toJsonValue(defaultBootstrap.settings.productVariants),
        heroImageCount: defaultBootstrap.settings.heroImageCount,
        heroMediaMode: defaultBootstrap.settings.heroMediaMode ?? 'image',
      },
    });
  }

  if ((await client.mediaAsset.count({ where: { siteId: defaultSite.id } })) === 0) {
    await client.mediaAsset.createMany({
      data: [...defaultBootstrap.heroImages, ...defaultBootstrap.detailImages].map((asset) => ({
        siteId: defaultSite.id,
        section: asset.section,
        sourceType: asset.sourceType,
        kind: asset.kind ?? 'image',
        posterSource: asset.posterSource ?? null,
        source: asset.source,
        alt: asset.alt,
        sortOrder: asset.sortOrder,
        enabled: asset.enabled,
      })),
    });
  }

  if ((await client.review.count({ where: { siteId: defaultSite.id } })) === 0) {
    await client.review.createMany({
      data: defaultBootstrap.allReviews.map((review) => ({
        siteId: defaultSite.id,
        name: review.name,
        content: review.content,
        images: toJsonValue(review.images),
        displayDate: normalizeDisplayDate(review.displayDate) ?? null,
        featuredOnHome: review.featuredOnHome,
        homeOrder: review.homeOrder,
        enabled: review.enabled,
        createdAt: new Date(review.createdAt),
        updatedAt: new Date(review.updatedAt),
      })),
    });
  }

  if ((await client.floatingPurchase.count({ where: { siteId: defaultSite.id } })) === 0) {
    await client.floatingPurchase.createMany({
      data: defaultBootstrap.floatingPurchases.map((purchase) => ({
        siteId: defaultSite.id,
        content: purchase.content,
        enabled: purchase.enabled,
        sortOrder: purchase.sortOrder,
        createdAt: new Date(purchase.createdAt),
        updatedAt: new Date(purchase.updatedAt),
      })),
    });
  }
}

function topReviews(reviews: Review[]) {
  const enabled = reviews.filter((review) => review.enabled);
  const featured = enabled.filter((review) => review.featuredOnHome).sort((a, b) => a.homeOrder - b.homeOrder || b.createdAt.localeCompare(a.createdAt));
  return featured.length ? featured : [...enabled].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function getActiveSiteRecord() {
  const active = await client.site.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
  if (active) return active;
  const first = await client.site.findFirst({ orderBy: { id: 'asc' } });
  if (!first) throw new Error('site not seeded');
  await client.site.update({ where: { id: first.id }, data: { isActive: true } });
  return { ...first, isActive: true };
}

async function resolveSiteId(siteId?: number) {
  return siteId ?? (await getActiveSiteRecord()).id;
}

async function duplicateSiteContent(templateSiteId: number, newSiteId: number) {
  const timestamp = new Date();
  const templateSettings = await client.siteSettings.findUnique({ where: { siteId: templateSiteId } });
  
  if (!templateSettings) {
    console.error(`[duplicateSiteContent] Template site ${templateSiteId} has no settings, using default settings`);
    const settings = { ...defaultSiteSettings, id: 0, siteId: templateSiteId, createdAt: timestamp, updatedAt: timestamp };
    
    await client.siteSettings.create({
      data: {
        siteId: newSiteId,
        shopName: settings.shopName,
        title: settings.title,
        subtitle: settings.subtitle,
        highlight: settings.highlight,
        serviceNote: settings.serviceNote,
        guarantee: toJsonValue(settings.guarantee as unknown),
        productDescription: settings.productDescription,
        shippingNote: settings.shippingNote,
        reminder: settings.reminder,
        shippingTime: settings.shippingTime,
        salePrice: settings.salePrice,
        originalPrice: settings.originalPrice,
        soldText: settings.soldText,
        marqueeText: settings.marqueeText,
        reviewTags: toJsonValue(settings.reviewTags as unknown),
        productVariants: toJsonValue(settings.productVariants as unknown),
        heroImageCount: settings.heroImageCount,
        heroMediaMode: settings.heroMediaMode ?? 'image',
        paymentSuccessMessage: '添加客服领取服用说明',
        customerServiceUrl: '',
      },
    });
    return;
  }
  
  console.log(`[duplicateSiteContent] Copying from site ${templateSiteId} (${templateSettings.shopName}) to site ${newSiteId}`);
  
  await client.siteSettings.create({
    data: {
      siteId: newSiteId,
      shopName: templateSettings.shopName,
      title: templateSettings.title,
      subtitle: templateSettings.subtitle,
      highlight: templateSettings.highlight,
      serviceNote: templateSettings.serviceNote,
      guarantee: toJsonValue(templateSettings.guarantee as unknown),
      productDescription: templateSettings.productDescription,
      shippingNote: templateSettings.shippingNote,
      reminder: templateSettings.reminder,
      shippingTime: templateSettings.shippingTime,
      salePrice: templateSettings.salePrice,
      originalPrice: templateSettings.originalPrice,
      soldText: templateSettings.soldText,
      marqueeText: templateSettings.marqueeText,
      reviewTags: toJsonValue(templateSettings.reviewTags as unknown),
      productVariants: toJsonValue(templateSettings.productVariants as unknown),
      heroImageCount: templateSettings.heroImageCount,
      heroMediaMode: templateSettings.heroMediaMode,
      paymentSuccessMessage: templateSettings.paymentSuccessMessage,
      customerServiceUrl: templateSettings.customerServiceUrl,
      customerServiceQrCode: templateSettings.customerServiceQrCode,
    },
  });

  const [mediaAssets, reviews, floatingPurchases] = await Promise.all([
    client.mediaAsset.findMany({ where: { siteId: templateSiteId } }),
    client.review.findMany({ where: { siteId: templateSiteId } }),
    client.floatingPurchase.findMany({ where: { siteId: templateSiteId } }),
  ]);

  if (mediaAssets.length) {
    await client.mediaAsset.createMany({
      data: mediaAssets.map((asset) => ({ siteId: newSiteId, section: asset.section, sourceType: asset.sourceType, kind: asset.kind, posterSource: asset.posterSource, source: asset.source, alt: asset.alt, sortOrder: asset.sortOrder, enabled: asset.enabled })),
    });
  }
  if (reviews.length) {
    await client.review.createMany({
      data: reviews.map((review) => ({ siteId: newSiteId, name: review.name, displayDate: review.displayDate, content: review.content, images: toJsonValue(review.images), featuredOnHome: review.featuredOnHome, homeOrder: review.homeOrder, enabled: review.enabled })),
    });
  }
  if (floatingPurchases.length) {
    await client.floatingPurchase.createMany({
      data: floatingPurchases.map((purchase) => ({ siteId: newSiteId, content: purchase.content, enabled: purchase.enabled, sortOrder: purchase.sortOrder })),
    });
  }
  
  console.log(`[duplicateSiteContent] Successfully copied site content: ${mediaAssets.length} media assets, ${reviews.length} reviews, ${floatingPurchases.length} floating purchases`);
}

export async function createPrismaStore(): Promise<ContentStore> {
  // Check before the first query; never initialize content in another database.
  if (new URL(process.env.DATABASE_URL ?? '').pathname !== '/fsd') {
    throw new Error('DATABASE_URL must point to fsd');
  }
  await ensureSeed();

  // 使用具名变量而不是在对象字面量里用 this：
  // 否则 this 会被推断为 ContentStore | PromiseLike<ContentStore>，导致方法调用全部报错
  const store: ContentStore = {
    async getActiveSite() {
      return mapSite(await getActiveSiteRecord());
    },
    async getSiteBySlug(slug: string) {
      const site = await client.site.findUnique({ where: { slug } });
      return site ? mapSite(site) : null;
    },
    async listSites() {
      const records = await client.site.findMany({ orderBy: [{ id: 'asc' }] });
      return records.map(mapSite);
    },
    async createSite(input: SiteInput) {
      try {
        const templateId = input.templateSiteId && await client.site.findUnique({ where: { id: input.templateSiteId } }) ? input.templateSiteId : (await getActiveSiteRecord()).id;
        console.log(`[createSite] Creating site with template ${templateId}`);
        const record = await client.site.create({
          data: {
            name: input.name.trim() || '新站点',
            slug: normalizeSlug(input.slug || input.name || 'new-site'),
            isActive: false,
          },
        });
        console.log(`[createSite] Site created with id ${record.id}, duplicating content from template ${templateId}`);
        await duplicateSiteContent(templateId, record.id);
        console.log(`[createSite] Content duplication completed successfully`);
        return mapSite(record);
      } catch (error) {
        console.error('[createSite] Error:', error);
        // Prisma unique constraint violation
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          throw new Error('站点标识已存在，请使用不同的标识');
        }
        throw error;
      }
    },
    async updateSite(id: number, input: SiteUpdateInput) {
      const record = await client.site.update({ where: { id }, data: { name: input.name.trim(), slug: normalizeSlug(input.slug) } }).catch(() => null);
      return record ? mapSite(record) : null;
    },
    async switchSite(id: number) {
      const exists = await client.site.findUnique({ where: { id } });
      if (!exists) return null;
      
      // 简单切换当前站点的激活状态
      const updated = await client.site.update({ 
        where: { id }, 
        data: { isActive: !exists.isActive } 
      });
      
      return mapSite(updated);
    },

    async deleteSite(id: number) {
      const exists = await client.site.findUnique({ where: { id } });
      if (!exists) return false;
      const count = await client.site.count();
      if (count <= 1) return false;
      
      // 检查是否有订单
      const orderCount = await client.order.count({ where: { siteId: id } });
      if (orderCount > 0) {
        throw new Error(`无法删除站点：该站点有 ${orderCount} 个订单，请先处理订单`);
      }
      
      await client.site.delete({ where: { id } });
      return true;
    },
    async getBootstrap(siteId?: number): Promise<PublicBootstrap> {
      const resolvedSiteId = await resolveSiteId(siteId);
      const [site, settings, mediaAssets, reviews, floatingPurchases] = await Promise.all([
        client.site.findUnique({ where: { id: resolvedSiteId } }),
        client.siteSettings.findUnique({ where: { siteId: resolvedSiteId } }),
        client.mediaAsset.findMany({ where: { siteId: resolvedSiteId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
        client.review.findMany({ where: { siteId: resolvedSiteId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
        client.floatingPurchase.findMany({ where: { siteId: resolvedSiteId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      ]);

      if (!site || !settings) throw new Error('site settings not seeded');

      const mappedMedia = mediaAssets.filter((item) => item.enabled).map(mapMediaAsset);
      const mappedReviews = reviews.map(mapReview);

      return {
        site: mapSite(site),
        settings: mapSettings(settings),
        heroImages: settings.heroMediaMode === 'video' ? [] : mappedMedia.filter((item) => item.section === 'hero' && item.kind === 'image').slice(0, 15),
        heroVideo: settings.heroMediaMode === 'video' ? mappedMedia.find((item) => item.section === 'hero' && item.kind === 'video') ?? null : null,
        detailImages: mappedMedia.filter((item) => item.section === 'detail' && item.kind === 'image'),
        reviews: topReviews(mappedReviews).slice(0, 2),
        allReviews: mappedReviews.filter((review) => review.enabled),
        floatingPurchases: floatingPurchases.filter((item) => item.enabled).map(mapFloatingPurchase),
      };
    },
    async getAdminBootstrap(siteId?: number) {
      const bootstrap = await store.getBootstrap(siteId);
      const resolvedSiteId = bootstrap.site.id;
      const [mediaAssets, floatingPurchases, allReviews] = await Promise.all([
        store.listMediaAssets(undefined, resolvedSiteId),
        store.listFloatingPurchases(resolvedSiteId),
        store.listReviews(resolvedSiteId),
      ]);
      return {
        ...bootstrap,
        heroImages: mediaAssets.filter((item) => item.section === 'hero' && item.kind === 'image'),
        heroVideo: mediaAssets.find((item) => item.section === 'hero' && item.kind === 'video') ?? null,
        detailImages: mediaAssets.filter((item) => item.section === 'detail' && item.kind === 'image'),
        allReviews,
        floatingPurchases,
        authenticated: true,
        sites: await store.listSites(),
        activeSiteId: bootstrap.site.id,
      };
    },
    async getSiteSettings(siteId?: number) {
      const record = await client.siteSettings.findUnique({ where: { siteId: await resolveSiteId(siteId) } });
      if (!record) throw new Error('site settings not found');
      return mapSettings(record);
    },
    async updateSiteSettings(input: SiteSettingsUpdateInput, siteId?: number) {
      const resolvedSiteId = await resolveSiteId(siteId);
      
      const record = await client.siteSettings.update({
        where: { siteId: resolvedSiteId },
        data: {
          shopName: input.shopName,
          title: input.title,
          subtitle: input.subtitle,
          highlight: input.highlight,
          serviceNote: input.serviceNote,
          guarantee: toJsonValue(input.guarantee),
          productDescription: input.productDescription,
          shippingNote: input.shippingNote,
          reminder: input.reminder,
          shippingTime: input.shippingTime,
          soldText: input.soldText,
          marqueeText: input.marqueeText,
          reviewTags: toJsonValue(input.reviewTags),
          heroImageCount: input.heroImageCount,
          paymentSuccessMessage: input.paymentSuccessMessage || defaultBootstrap.settings.paymentSuccessMessage,
          customerServiceUrl: input.customerServiceUrl ?? '',
          customerServiceQrCode: input.customerServiceQrCode?.trim() || null,
        },
      });
      return mapSettings(record);
    },
    async updateHeroMediaMode(mode, siteId) {
      const resolved = await resolveSiteId(siteId);
      return client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "SiteSettings" WHERE "siteId" = ${resolved} FOR UPDATE`;
        const row = await tx.siteSettings.update({ where: { siteId: resolved }, data: { heroMediaMode: mode } });
        return mapSettings(row);
      });
    },
    async listMediaAssets(section?: MediaSection, siteId?: number) {
      const records = await client.mediaAsset.findMany({
        where: { siteId: await resolveSiteId(siteId), ...(section ? { section } : {}) },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
      return records.map(mapMediaAsset);
    },
    async createMediaAsset(input: MediaAssetInput, siteId?: number) {
      const record = await client.mediaAsset.create({ data: { ...input, siteId: await resolveSiteId(siteId) } });
      return mapMediaAsset(record);
    },
    async updateMediaAsset(id: number, input: MediaAssetInput, siteId?: number) {
      const result = await client.mediaAsset.updateMany({ where: { id, siteId: await resolveSiteId(siteId) }, data: input });
      if (!result.count) return null;
      const record = await client.mediaAsset.findUnique({ where: { id } });
      return record ? mapMediaAsset(record) : null;
    },
    async deleteMediaAsset(id: number, siteId?: number) {
      const result = await client.mediaAsset.deleteMany({ where: { id, siteId: await resolveSiteId(siteId) } });
      return result.count > 0;
    },
    async listReviews(siteId?: number) {
      const records = await client.review.findMany({ where: { siteId: await resolveSiteId(siteId) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return records.map(mapReview);
    },
    async createReview(input: ReviewInput, siteId?: number) {
      const displayDate = normalizeDisplayDate(input.displayDate);
      const record = await client.review.create({
        data: {
          siteId: await resolveSiteId(siteId),
          name: input.name,
          displayDate,
          content: input.content,
          images: toJsonValue(input.images),
          featuredOnHome: input.featuredOnHome,
          homeOrder: input.homeOrder,
          enabled: input.enabled,
        },
      });
      return mapReview(record);
    },
    async updateReview(id: number, input: ReviewInput, siteId?: number) {
      const displayDate = normalizeDisplayDate(input.displayDate);
      const result = await client.review.updateMany({
        where: { id, siteId: await resolveSiteId(siteId) },
        data: { name: input.name, ...(displayDate !== undefined ? { displayDate } : {}), content: input.content, images: toJsonValue(input.images), featuredOnHome: input.featuredOnHome, homeOrder: input.homeOrder, enabled: input.enabled },
      });
      if (!result.count) return null;
      const record = await client.review.findUnique({ where: { id } });
      return record ? mapReview(record) : null;
    },
    async deleteReview(id: number, siteId?: number) {
      const result = await client.review.deleteMany({ where: { id, siteId: await resolveSiteId(siteId) } });
      return result.count > 0;
    },
    async listFloatingPurchases(siteId?: number) {
      const records = await client.floatingPurchase.findMany({ where: { siteId: await resolveSiteId(siteId) }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
      return records.map(mapFloatingPurchase);
    },
    async createFloatingPurchase(input: FloatingPurchaseInput, siteId?: number) {
      const record = await client.floatingPurchase.create({ data: { ...input, siteId: await resolveSiteId(siteId) } });
      return mapFloatingPurchase(record);
    },
    async updateFloatingPurchase(id: number, input: FloatingPurchaseInput, siteId?: number) {
      const result = await client.floatingPurchase.updateMany({ where: { id, siteId: await resolveSiteId(siteId) }, data: input });
      if (!result.count) return null;
      const record = await client.floatingPurchase.findUnique({ where: { id } });
      return record ? mapFloatingPurchase(record) : null;
    },
    async deleteFloatingPurchase(id: number, siteId?: number) {
      const result = await client.floatingPurchase.deleteMany({ where: { id, siteId: await resolveSiteId(siteId) } });
      return result.count > 0;
    },
  };

  return store;
}

export { client as prismaClient, ensureSeed };
