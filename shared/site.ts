export type MediaSection = 'hero' | 'detail';
export type MediaSourceType = 'upload' | 'url';

export type Site = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SiteSettings = {
  id: number;
  siteId: number;
  shopName: string;
  title: string;
  subtitle: string;
  highlight: string;
  serviceNote: string;
  guarantee: string[];
  productDescription: string;
  shippingNote: string;
  reminder: string;
  shippingTime: string;
  salePrice: number;
  originalPrice: number;
  soldText: string;
  marqueeText: string;
  reviewTags: string[];
  productVariants: ProductVariant[];
  heroImageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductVariant = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  originalPrice: number;
  saleLabel: string;
  highlight?: string;
};

export type MediaAsset = {
  id: number;
  siteId: number;
  section: MediaSection;
  sourceType: MediaSourceType;
  source: string;
  alt: string;
  sortOrder: number;
  enabled: boolean;
  resolvedUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type Review = {
  id: number;
  siteId: number;
  name: string;
  content: string;
  images: string[];
  featuredOnHome: boolean;
  homeOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FloatingPurchase = {
  id: number;
  siteId: number;
  content: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicBootstrap = {
  site: Site;
  settings: SiteSettings;
  heroImages: MediaAsset[];
  detailImages: MediaAsset[];
  reviews: Review[];
  allReviews: Review[];
  floatingPurchases: FloatingPurchase[];
};

export type AdminBootstrap = PublicBootstrap & {
  authenticated: true;
  sites: Site[];
  activeSiteId: number;
};

export type SiteInput = {
  name: string;
  slug: string;
  templateSiteId?: number;
};

export type SiteUpdateInput = {
  name: string;
  slug: string;
};

export type SiteSettingsUpdateInput = Omit<SiteSettings, 'id' | 'siteId' | 'createdAt' | 'updatedAt'>;

export type MediaAssetInput = {
  section: MediaSection;
  sourceType: MediaSourceType;
  source: string;
  alt: string;
  sortOrder: number;
  enabled: boolean;
};

export type ReviewInput = {
  name: string;
  content: string;
  images: string[];
  featuredOnHome: boolean;
  homeOrder: number;
  enabled: boolean;
};

export type FloatingPurchaseInput = {
  content: string;
  enabled: boolean;
  sortOrder: number;
};

const now = new Date().toISOString();

const defaultSite: Site = {
  id: 1,
  name: '默认站点',
  slug: 'default',
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

const heroImages = [
  '/assets/hero-1.jpg',
  '/assets/hero-2.jpg',
  '/assets/hero-3.jpg',
  '/assets/hero-4.jpg',
  '/assets/hero-5.jpg',
].map((source, index) => ({
  id: index + 1,
  siteId: defaultSite.id,
  section: 'hero' as const,
  sourceType: 'upload' as const,
  source,
  alt: `商品主图 ${index + 1}`,
  sortOrder: index + 1,
  enabled: true,
  resolvedUrl: source,
  createdAt: now,
  updatedAt: now,
}));

const detailSources = [
  '/assets/detail-1.jpg',
  '/assets/detail-2.jpg',
  '/assets/detail-3.jpg',
  '/assets/detail-4.jpg',
  '/assets/detail-5.jpg',
  '/assets/detail-6.jpg',
  '/assets/detail-7.jpg',
];

const detailImages = detailSources.map((source, index) => ({
  id: index + 101,
  siteId: defaultSite.id,
  section: 'detail' as const,
  sourceType: 'upload' as const,
  source,
  alt: `详情图 ${index + 1}`,
  sortOrder: index + 1,
  enabled: true,
  resolvedUrl: source,
  createdAt: now,
  updatedAt: now,
}));

const reviewImages = ['/assets/review-tags.png'];

const reviews = [
  {
    id: 1,
    siteId: defaultSite.id,
    name: '悹**7',
    content: '这次在网上看到就买来试试，效果是真心好啊。产品用着挺稳，物流也快，包装很完整。',
    images: reviewImages,
    featuredOnHome: true,
    homeOrder: 1,
    enabled: true,
    createdAt: '2026-08-26T00:00:00.000Z',
    updatedAt: now,
  },
  {
    id: 2,
    siteId: defaultSite.id,
    name: '张**9',
    content: '客服回复很及时，查询订单也方便。套餐价格比单买更划算，准备继续复购。',
    images: reviewImages,
    featuredOnHome: true,
    homeOrder: 2,
    enabled: true,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: now,
  },
];

const floatingPurchases = [
  '李**6分钟前已购买',
  '王**10分钟前已购买',
  '张**2分钟前已购买',
].map((content, index) => ({
  id: index + 1,
  siteId: defaultSite.id,
  content,
  enabled: true,
  sortOrder: index + 1,
  createdAt: now,
  updatedAt: now,
}));

export const defaultSiteSettings: SiteSettings = {
  id: 1,
  siteId: defaultSite.id,
  shopName: '单品商城 · 正品官方',
  title: '参茸 养心益肾胶囊 正品官方 勃起苦困难 阳痿早泄 OTC 国药准字',
  subtitle: '本品售出，非质量问题不退不换',
  highlight: '立赠1盒男士战斗礼包，中西结合更强更科学',
  serviceNote: '免费包邮 · 18:00 前下单承诺当日发出',
  guarantee: ['商城官方自营', '正品保证，不仅全，而且更安全', '下单后短信通知物流', '支付成功后进入客服引导'],
  productDescription: '立赠1盒男士战斗礼包，中西结合更强更科学',
  shippingNote: '免费包邮',
  reminder: '正品保证，不仅全，而且更安全',
  shippingTime: '18:00 前下单，承诺当日发出',
  salePrice: 99,
  originalPrice: 299,
  soldText: '50000+已售',
  marqueeText: 'xxx购买',
  reviewTags: ['效果明显', '价格便宜', '发货快', '物流快', '服务好'],
  productVariants: [
    { id: 'single', name: '单盒体验装', subtitle: '先试用再决定', price: 99, originalPrice: 299, saleLabel: '券后价' },
    { id: 'double', name: '2盒组合装', subtitle: '更适合持续使用', price: 178, originalPrice: 598, saleLabel: '组合价', highlight: '立减 20%' },
    { id: 'family', name: '3盒家庭装', subtitle: '赠礼包装 + 优先发货', price: 258, originalPrice: 897, saleLabel: '限时价', highlight: '赠礼盒' },
  ],
  heroImageCount: 5,
  createdAt: now,
  updatedAt: now,
};

export const defaultBootstrap: PublicBootstrap = {
  site: defaultSite,
  settings: defaultSiteSettings,
  heroImages,
  detailImages,
  reviews,
  allReviews: reviews,
  floatingPurchases,
};

export function resolveMediaUrl(source: string) {
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('/')) return source;
  return `/${source.replace(/^\/+/, '')}`;
}

export function sortByOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function mapBootstrapWithResolvedUrls(data: PublicBootstrap): PublicBootstrap {
  return {
    ...data,
    heroImages: data.heroImages.map((asset) => ({ ...asset, resolvedUrl: resolveMediaUrl(asset.source) })),
    detailImages: data.detailImages.map((asset) => ({ ...asset, resolvedUrl: resolveMediaUrl(asset.source) })),
  };
}
