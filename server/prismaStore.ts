import { PrismaClient, Prisma } from '@prisma/client';
import {
  defaultBootstrap,
  type FloatingPurchase,
  type FloatingPurchaseInput,
  type MediaAsset,
  type MediaAssetInput,
  type MediaSection,
  type PublicBootstrap,
  type Review,
  type ReviewInput,
  type SiteSettings,
  type SiteSettingsUpdateInput,
  resolveMediaUrl,
  sortByOrder,
} from '../shared/site';
import type { ContentStore } from './store';

const client = new PrismaClient();

function toStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function mapSettings(record: {
  id: number;
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
  createdAt: Date;
  updatedAt: Date;
}): SiteSettings {
  return {
    id: record.id,
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
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapMediaAsset(record: {
  id: number;
  section: string;
  sourceType: string;
  source: string;
  alt: string;
  sortOrder: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): MediaAsset {
  return {
    id: record.id,
    section: record.section as MediaSection,
    sourceType: record.sourceType as MediaAsset['sourceType'],
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
  id: number;
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
    name: record.name,
    content: record.content,
    images: toStringArray(record.images),
    featuredOnHome: record.featuredOnHome,
    homeOrder: record.homeOrder,
    enabled: record.enabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapFloatingPurchase(record: {
  id: number;
  content: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): FloatingPurchase {
  return {
    id: record.id,
    content: record.content,
    enabled: record.enabled,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function ensureSeed() {
  const existing = await client.siteSettings.findUnique({ where: { id: 1 } });
  if (!existing) {
    await client.siteSettings.create({
      data: {
        id: 1,
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
      },
    });
  }

  if ((await client.mediaAsset.count()) === 0) {
    await client.mediaAsset.createMany({
      data: [...defaultBootstrap.heroImages, ...defaultBootstrap.detailImages].map((asset) => ({
        section: asset.section,
        sourceType: asset.sourceType,
        source: asset.source,
        alt: asset.alt,
        sortOrder: asset.sortOrder,
        enabled: asset.enabled,
      })),
    });
  }

  if ((await client.review.count()) === 0) {
    await client.review.createMany({
      data: defaultBootstrap.allReviews.map((review) => ({
        name: review.name,
        content: review.content,
        images: toJsonValue(review.images),
        featuredOnHome: review.featuredOnHome,
        homeOrder: review.homeOrder,
        enabled: review.enabled,
        createdAt: new Date(review.createdAt),
        updatedAt: new Date(review.updatedAt),
      })),
    });
  }

  if ((await client.floatingPurchase.count()) === 0) {
    await client.floatingPurchase.createMany({
      data: defaultBootstrap.floatingPurchases.map((purchase) => ({
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

export async function createPrismaStore(): Promise<ContentStore> {
  await ensureSeed();

  return {
    async getBootstrap(): Promise<PublicBootstrap> {
      const [settings, mediaAssets, reviews, floatingPurchases] = await Promise.all([
        client.siteSettings.findUnique({ where: { id: 1 } }),
        client.mediaAsset.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
        client.review.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
        client.floatingPurchase.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      ]);

      if (!settings) {
        throw new Error('site settings not seeded');
      }

      const mappedMedia = mediaAssets.filter((item) => item.enabled).map(mapMediaAsset);
      const mappedReviews = reviews.map(mapReview);

      return {
        settings: mapSettings(settings),
        heroImages: mappedMedia.filter((item) => item.section === 'hero'),
        detailImages: mappedMedia.filter((item) => item.section === 'detail'),
        reviews: topReviews(mappedReviews).slice(0, 2),
        allReviews: mappedReviews,
        floatingPurchases: floatingPurchases.filter((item) => item.enabled).map(mapFloatingPurchase),
      };
    },
    async getAdminBootstrap() {
      return {
        ...(await this.getBootstrap()),
        authenticated: true,
      };
    },
    async getSiteSettings() {
      const record = await client.siteSettings.findUnique({ where: { id: 1 } });
      if (!record) throw new Error('site settings not found');
      return mapSettings(record);
    },
    async updateSiteSettings(input: SiteSettingsUpdateInput) {
      const record = await client.siteSettings.update({
        where: { id: 1 },
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
          salePrice: input.salePrice,
          originalPrice: input.originalPrice,
          soldText: input.soldText,
          marqueeText: input.marqueeText,
          reviewTags: toJsonValue(input.reviewTags),
          productVariants: toJsonValue(input.productVariants),
          heroImageCount: input.heroImageCount,
        },
      });
      return mapSettings(record);
    },
    async listMediaAssets(section?: MediaSection) {
      const records = await client.mediaAsset.findMany({
        where: section ? { section } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
      return records.map(mapMediaAsset);
    },
    async createMediaAsset(input: MediaAssetInput) {
      const record = await client.mediaAsset.create({ data: input });
      return mapMediaAsset(record);
    },
    async updateMediaAsset(id: number, input: MediaAssetInput) {
      const record = await client.mediaAsset.update({ where: { id }, data: input }).catch(() => null);
      return record ? mapMediaAsset(record) : null;
    },
    async deleteMediaAsset(id: number) {
      const result = await client.mediaAsset.deleteMany({ where: { id } });
      return result.count > 0;
    },
    async listReviews() {
      const records = await client.review.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return records.map(mapReview);
    },
    async createReview(input: ReviewInput) {
      const record = await client.review.create({
        data: {
          name: input.name,
          content: input.content,
          images: toJsonValue(input.images),
          featuredOnHome: input.featuredOnHome,
          homeOrder: input.homeOrder,
          enabled: input.enabled,
        },
      });
      return mapReview(record);
    },
    async updateReview(id: number, input: ReviewInput) {
      const record = await client.review.update({
        where: { id },
        data: {
          name: input.name,
          content: input.content,
          images: toJsonValue(input.images),
          featuredOnHome: input.featuredOnHome,
          homeOrder: input.homeOrder,
          enabled: input.enabled,
        },
      }).catch(() => null);
      return record ? mapReview(record) : null;
    },
    async deleteReview(id: number) {
      const result = await client.review.deleteMany({ where: { id } });
      return result.count > 0;
    },
    async listFloatingPurchases() {
      const records = await client.floatingPurchase.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
      return records.map(mapFloatingPurchase);
    },
    async createFloatingPurchase(input: FloatingPurchaseInput) {
      const record = await client.floatingPurchase.create({ data: input });
      return mapFloatingPurchase(record);
    },
    async updateFloatingPurchase(id: number, input: FloatingPurchaseInput) {
      const record = await client.floatingPurchase.update({ where: { id }, data: input }).catch(() => null);
      return record ? mapFloatingPurchase(record) : null;
    },
    async deleteFloatingPurchase(id: number) {
      const result = await client.floatingPurchase.deleteMany({ where: { id } });
      return result.count > 0;
    },
  };
}

export { client as prismaClient, ensureSeed };
