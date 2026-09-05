import { ContentValidationError, validateDisplayDate, validateMediaWrite, validateMediaModeWrite } from '../shared/contentValidation';
import {
  defaultBootstrap,
  defaultSiteSettings,
  type AdminBootstrap,
  type FloatingPurchase,
  type FloatingPurchaseInput,
  type MediaAsset,
  type MediaAssetInput,
  type MediaKind,
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
  sortByOrder,
} from '../shared/site';

export type ContentStore = {
  getActiveSite: () => Promise<Site>;
  getSiteBySlug: (slug: string) => Promise<Site | null>;
  listSites: () => Promise<Site[]>;
  createSite: (input: SiteInput) => Promise<Site>;
  updateSite: (id: number, input: SiteUpdateInput) => Promise<Site | null>;
  deleteSite: (id: number) => Promise<boolean>;
  switchSite: (id: number) => Promise<Site | null>;
  getBootstrap: (siteId?: number) => Promise<PublicBootstrap>;
  getAdminBootstrap: (siteId?: number) => Promise<AdminBootstrap>;
  getSiteSettings: (siteId?: number) => Promise<SiteSettings>;
  updateSiteSettings: (input: SiteSettingsUpdateInput, siteId?: number) => Promise<SiteSettings>;
  updateHeroMediaMode: (mode: MediaKind, siteId?: number) => Promise<SiteSettings>;
  listMediaAssets: (section?: MediaSection, siteId?: number) => Promise<MediaAsset[]>;
  createMediaAsset: (input: MediaAssetInput, siteId?: number) => Promise<MediaAsset>;
  updateMediaAsset: (id: number, input: MediaAssetInput, siteId?: number) => Promise<MediaAsset | null>;
  deleteMediaAsset: (id: number, siteId?: number) => Promise<boolean>;
  listReviews: (siteId?: number) => Promise<Review[]>;
  createReview: (input: ReviewInput, siteId?: number) => Promise<Review>;
  updateReview: (id: number, input: ReviewInput, siteId?: number) => Promise<Review | null>;
  deleteReview: (id: number, siteId?: number) => Promise<boolean>;
  listFloatingPurchases: (siteId?: number) => Promise<FloatingPurchase[]>;
  createFloatingPurchase: (input: FloatingPurchaseInput, siteId?: number) => Promise<FloatingPurchase>;
  updateFloatingPurchase: (id: number, input: FloatingPurchaseInput, siteId?: number) => Promise<FloatingPurchase | null>;
  deleteFloatingPurchase: (id: number, siteId?: number) => Promise<boolean>;
};

type SeedState = {
  sites: Site[];
  settings: SiteSettings[];
  mediaAssets: MediaAsset[];
  reviews: Review[];
  floatingPurchases: FloatingPurchase[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildSeedState(): SeedState {
  return {
    sites: [clone(defaultBootstrap.site)],
    settings: [clone(defaultBootstrap.settings)],
    mediaAssets: [...defaultBootstrap.heroImages, ...defaultBootstrap.detailImages].map(clone),
    reviews: clone(defaultBootstrap.allReviews),
    floatingPurchases: clone(defaultBootstrap.floatingPurchases),
  };
}

function makeId(items: { id: number }[]) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || `site-${Date.now()}`;
}

function activeSiteId(state: SeedState) {
  return state.sites.find((site) => site.isActive)?.id ?? state.sites[0]?.id ?? 1;
}

function siteOrActive(state: SeedState, siteId?: number) {
  const id = siteId ?? activeSiteId(state);
  const site = state.sites.find((item) => item.id === id);
  if (!site) throw new Error('site not found');
  return site;
}

function buildMediaAsset(input: MediaAssetInput, id: number, siteId: number): MediaAsset {
  const timestamp = new Date().toISOString();
  return {
    id,
    siteId,
    kind: input.kind ?? 'image',
    posterSource: input.posterSource ?? null,
    section: input.section,
    sourceType: input.sourceType,
    source: input.source,
    alt: input.alt,
    sortOrder: input.sortOrder,
    enabled: input.enabled,
    resolvedUrl: resolveMediaUrl(input.source),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildReview(input: ReviewInput, id: number, siteId: number): Review {
  const timestamp = new Date().toISOString();
  return {
    id,
    siteId,
    displayDate: input.displayDate ?? null,
    name: input.name,
    content: input.content,
    images: input.images,
    featuredOnHome: input.featuredOnHome,
    homeOrder: input.homeOrder,
    enabled: input.enabled,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildFloatingPurchase(input: FloatingPurchaseInput, id: number, siteId: number): FloatingPurchase {
  const timestamp = new Date().toISOString();
  return {
    id,
    siteId,
    content: input.content,
    enabled: input.enabled,
    sortOrder: input.sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function topReviews(reviews: Review[]) {
  const enabled = reviews.filter((review) => review.enabled);
  const featured = enabled
    .filter((review) => review.featuredOnHome)
    .sort((a, b) => a.homeOrder - b.homeOrder || b.createdAt.localeCompare(a.createdAt));

  if (featured.length) {
    return featured;
  }

  return [...enabled].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function scoped<T extends { siteId: number }>(items: T[], siteId: number) {
  return items.filter((item) => item.siteId === siteId);
}

export function createMemoryStore(seed: Partial<SeedState> = {}): ContentStore {
  const base = buildSeedState();
  const state: SeedState = {
    sites: clone(seed.sites ?? base.sites),
    settings: clone(seed.settings ?? base.settings).map(item => ({ ...item, heroMediaMode: item.heroMediaMode ?? 'image' })),
    mediaAssets: clone(seed.mediaAssets ?? base.mediaAssets).map(item => ({ ...item, kind: item.kind ?? 'image', posterSource: item.posterSource ?? null })),
    reviews: clone(seed.reviews ?? base.reviews).map(item => ({ ...item, displayDate: item.displayDate ?? null })),
    floatingPurchases: clone(seed.floatingPurchases ?? base.floatingPurchases),
  };

  return {
    async getActiveSite() {
      return clone(siteOrActive(state));
    },
    async getSiteBySlug(slug: string) {
      const normalized = normalizeSlug(slug);
      const site = state.sites.find((item) => item.slug === normalized);
      return site ? clone(site) : null;
    },
    async listSites() {
      return [...state.sites].sort((a, b) => a.id - b.id).map(clone);
    },
    async createSite(input) {
      const id = makeId(state.sites);
      const timestamp = new Date().toISOString();
      const site: Site = {
        id,
        name: input.name.trim() || `站点 ${id}`,
        slug: normalizeSlug(input.slug || input.name || `site-${id}`),
        isActive: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const templateId = input.templateSiteId && state.sites.some((item) => item.id === input.templateSiteId) ? input.templateSiteId : activeSiteId(state);
      const templateSettings = state.settings.find((item) => item.siteId === templateId) ?? defaultSiteSettings;

      state.sites.push(site);
      state.settings.push({ ...clone(templateSettings), id: makeId(state.settings), siteId: id, createdAt: timestamp, updatedAt: timestamp });
      scoped(state.mediaAssets, templateId).forEach((item) => state.mediaAssets.push({ ...clone(item), id: makeId(state.mediaAssets), siteId: id, createdAt: timestamp, updatedAt: timestamp }));
      scoped(state.reviews, templateId).forEach((item) => state.reviews.push({ ...clone(item), id: makeId(state.reviews), siteId: id, createdAt: timestamp, updatedAt: timestamp }));
      scoped(state.floatingPurchases, templateId).forEach((item) => state.floatingPurchases.push({ ...clone(item), id: makeId(state.floatingPurchases), siteId: id, createdAt: timestamp, updatedAt: timestamp }));

      return clone(site);
    },
    async updateSite(id, input) {
      const index = state.sites.findIndex((site) => site.id === id);
      if (index < 0) return null;
      state.sites[index] = {
        ...state.sites[index],
        name: input.name.trim() || state.sites[index].name,
        slug: normalizeSlug(input.slug || state.sites[index].slug),
        updatedAt: new Date().toISOString(),
      };
      return clone(state.sites[index]);
    },
    async switchSite(id) {
      const site = state.sites.find((item) => item.id === id);
      if (!site) return null;
      state.sites = state.sites.map((item) => (item.id === id ? { ...item, isActive: !item.isActive, updatedAt: new Date().toISOString() } : item));
      return clone(state.sites.find((item) => item.id === id)!);
    },
    async deleteSite(id) {
      const site = state.sites.find((item) => item.id === id);
      if (!site || state.sites.length <= 1) return false;
      state.sites = state.sites.filter((item) => item.id !== id);
      state.settings = state.settings.filter((item) => item.siteId !== id);
      state.mediaAssets = state.mediaAssets.filter((item) => item.siteId !== id);
      state.reviews = state.reviews.filter((item) => item.siteId !== id);
      state.floatingPurchases = state.floatingPurchases.filter((item) => item.siteId !== id);
      if (site.isActive) {
        const nextSite = state.sites[0];
        if (nextSite) {
          state.sites = state.sites.map((item) => ({
            ...item,
            isActive: item.id === nextSite.id,
            updatedAt: item.id === nextSite.id ? new Date().toISOString() : item.updatedAt,
          }));
        }
      }
      return true;
    },
    async getBootstrap(siteId) {
      const site = siteOrActive(state, siteId);
      const settings = state.settings.find((item) => item.siteId === site.id);
      if (!settings) throw new Error('site settings not found');
      const mediaAssets = sortByOrder(scoped(state.mediaAssets, site.id)).filter((item) => item.enabled).map((item) => ({ ...item, resolvedUrl: resolveMediaUrl(item.source) }));
      const reviews = scoped(state.reviews, site.id);
      return {
        site: clone(site),
        settings: clone(settings),
        heroImages: settings.heroMediaMode === 'video' ? [] : mediaAssets.filter((item) => item.section === 'hero' && item.kind === 'image').slice(0, 15),
        heroVideo: settings.heroMediaMode === 'video' ? mediaAssets.find(item => item.section === 'hero' && item.kind === 'video') ?? null : null,
        detailImages: mediaAssets.filter((item) => item.section === 'detail'),
        reviews: topReviews(reviews).slice(0, 2),
        allReviews: [...reviews].filter((review) => review.enabled).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        floatingPurchases: sortByOrder(scoped(state.floatingPurchases, site.id)).filter((item) => item.enabled),
      };
    },
    async getAdminBootstrap(siteId?: number) {
      const bootstrap = await this.getBootstrap(siteId);
      const resolvedSiteId = bootstrap.site.id;
      const mediaAssets = await this.listMediaAssets(undefined, resolvedSiteId);
      const allReviews = await this.listReviews(resolvedSiteId);
      return {
        ...bootstrap,
        heroImages: mediaAssets.filter((item) => item.section === 'hero' && item.kind === 'image'),
        heroVideo: mediaAssets.find(item => item.section === 'hero' && item.kind === 'video') ?? null,
        detailImages: mediaAssets.filter((item) => item.section === 'detail'),
        allReviews,
        floatingPurchases: await this.listFloatingPurchases(resolvedSiteId),
        authenticated: true,
        sites: await this.listSites(),
        activeSiteId: bootstrap.site.id,
      };
    },
    async getSiteSettings(siteId) {
      const site = siteOrActive(state, siteId);
      const settings = state.settings.find((item) => item.siteId === site.id);
      if (!settings) throw new Error('site settings not found');
      return clone(settings);
    },
    async updateSiteSettings(input, siteId) {
      const site = siteOrActive(state, siteId);
      const index = state.settings.findIndex((item) => item.siteId === site.id);
      if (index < 0) throw new Error('site settings not found');
      state.settings[index] = {
        ...state.settings[index],
        ...clone(input),
        heroMediaMode: state.settings[index].heroMediaMode ?? 'image',
        // 可选字段需显式覆盖：clone 会丢掉 undefined 键，导致清空二维码后旧值残留
        customerServiceQrCode: input.customerServiceQrCode?.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      return clone(state.settings[index]);
    },
    async updateHeroMediaMode(mode, siteId) {
      if (mode !== 'image' && mode !== 'video') throw new ContentValidationError('invalid mode');
      const site = siteOrActive(state, siteId);
      const settings = state.settings.find(item => item.siteId === site.id)!;
      settings.heroMediaMode = mode;
      settings.updatedAt = new Date().toISOString();
      return clone(settings);
    },
    async listMediaAssets(section, siteId) {
      const site = siteOrActive(state, siteId);
      return sortByOrder(scoped(state.mediaAssets, site.id))
        .filter((item) => (section ? item.section === section : true))
        .map((item) => ({ ...item, resolvedUrl: resolveMediaUrl(item.source) }));
    },
    async createMediaAsset(input, siteId) {
      const site = siteOrActive(state, siteId);
      validateMediaWrite(input, state.settings.find(item => item.siteId === site.id)!, state.mediaAssets);
      const item = buildMediaAsset(input, makeId(state.mediaAssets), site.id);
      state.mediaAssets.push(item);
      return clone(item);
    },
    async updateMediaAsset(id, input, siteId) {
      const site = siteOrActive(state, siteId);
      const index = state.mediaAssets.findIndex((item) => item.id === id && item.siteId === site.id);
      if (index < 0) return null;
      const settings = state.settings.find(item => item.siteId === site.id)!;
      validateMediaModeWrite(state.mediaAssets[index].section, state.mediaAssets[index].kind ?? 'image', settings);
      validateMediaWrite(input, settings, state.mediaAssets, id);
      const updated = {
        ...state.mediaAssets[index],
        kind: input.kind ?? 'image',
        posterSource: input.posterSource ?? null,
        ...clone(input),
        resolvedUrl: resolveMediaUrl(input.source),
        updatedAt: new Date().toISOString(),
      };
      state.mediaAssets[index] = updated;
      return clone(updated);
    },
    async deleteMediaAsset(id, siteId) {
      const site = siteOrActive(state, siteId);
      const existing = state.mediaAssets.find(item => item.id === id && item.siteId === site.id);
      if (existing) validateMediaModeWrite(existing.section, existing.kind ?? 'image', state.settings.find(item => item.siteId === site.id)!);
      const before = state.mediaAssets.length;
      state.mediaAssets = state.mediaAssets.filter((item) => item.id !== id || item.siteId !== site.id);
      return state.mediaAssets.length !== before;
    },
    async listReviews(siteId) {
      const site = siteOrActive(state, siteId);
      return scoped(state.reviews, site.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async createReview(input, siteId) {
      const site = siteOrActive(state, siteId);
      validateDisplayDate(input.displayDate);
      const item = buildReview(input, makeId(state.reviews), site.id);
      state.reviews.push(item);
      return clone(item);
    },
    async updateReview(id, input, siteId) {
      validateDisplayDate(input.displayDate);
      const site = siteOrActive(state, siteId);
      const index = state.reviews.findIndex((item) => item.id === id && item.siteId === site.id);
      if (index < 0) return null;
      const updated = {
        ...state.reviews[index],
        ...clone(input),
        updatedAt: new Date().toISOString(),
      };
      state.reviews[index] = updated;
      return clone(updated);
    },
    async deleteReview(id, siteId) {
      const site = siteOrActive(state, siteId);
      const before = state.reviews.length;
      state.reviews = state.reviews.filter((item) => item.id !== id || item.siteId !== site.id);
      return state.reviews.length !== before;
    },
    async listFloatingPurchases(siteId) {
      const site = siteOrActive(state, siteId);
      return sortByOrder(scoped(state.floatingPurchases, site.id));
    },
    async createFloatingPurchase(input, siteId) {
      const site = siteOrActive(state, siteId);
      const item = buildFloatingPurchase(input, makeId(state.floatingPurchases), site.id);
      state.floatingPurchases.push(item);
      return clone(item);
    },
    async updateFloatingPurchase(id, input, siteId) {
      const site = siteOrActive(state, siteId);
      const index = state.floatingPurchases.findIndex((item) => item.id === id && item.siteId === site.id);
      if (index < 0) return null;
      const updated = {
        ...state.floatingPurchases[index],
        ...clone(input),
        updatedAt: new Date().toISOString(),
      };
      state.floatingPurchases[index] = updated;
      return clone(updated);
    },
    async deleteFloatingPurchase(id, siteId) {
      const site = siteOrActive(state, siteId);
      const before = state.floatingPurchases.length;
      state.floatingPurchases = state.floatingPurchases.filter((item) => item.id !== id || item.siteId !== site.id);
      return state.floatingPurchases.length !== before;
    },
  };
}

export function isTruthy(value: string | undefined) {
  return value === '1' || value === 'true' || value === 'yes';
}

export { defaultBootstrap, defaultSiteSettings };
