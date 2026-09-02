import {
  defaultBootstrap,
  defaultSiteSettings,
  type AdminBootstrap,
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

export type ContentStore = {
  getBootstrap: () => Promise<PublicBootstrap>;
  getAdminBootstrap: () => Promise<AdminBootstrap>;
  getSiteSettings: () => Promise<SiteSettings>;
  updateSiteSettings: (input: SiteSettingsUpdateInput) => Promise<SiteSettings>;
  listMediaAssets: (section?: MediaSection) => Promise<MediaAsset[]>;
  createMediaAsset: (input: MediaAssetInput) => Promise<MediaAsset>;
  updateMediaAsset: (id: number, input: MediaAssetInput) => Promise<MediaAsset | null>;
  deleteMediaAsset: (id: number) => Promise<boolean>;
  listReviews: () => Promise<Review[]>;
  createReview: (input: ReviewInput) => Promise<Review>;
  updateReview: (id: number, input: ReviewInput) => Promise<Review | null>;
  deleteReview: (id: number) => Promise<boolean>;
  listFloatingPurchases: () => Promise<FloatingPurchase[]>;
  createFloatingPurchase: (input: FloatingPurchaseInput) => Promise<FloatingPurchase>;
  updateFloatingPurchase: (id: number, input: FloatingPurchaseInput) => Promise<FloatingPurchase | null>;
  deleteFloatingPurchase: (id: number) => Promise<boolean>;
};

type SeedState = {
  settings: SiteSettings;
  mediaAssets: MediaAsset[];
  reviews: Review[];
  floatingPurchases: FloatingPurchase[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildSeedState(): SeedState {
  return {
    settings: clone(defaultBootstrap.settings),
    mediaAssets: [...defaultBootstrap.heroImages, ...defaultBootstrap.detailImages].map(clone),
    reviews: clone(defaultBootstrap.allReviews),
    floatingPurchases: clone(defaultBootstrap.floatingPurchases),
  };
}

function makeId(items: { id: number }[]) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function buildMediaAsset(input: MediaAssetInput, id: number): MediaAsset {
  const timestamp = new Date().toISOString();
  return {
    id,
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

function buildReview(input: ReviewInput, id: number): Review {
  const timestamp = new Date().toISOString();
  return {
    id,
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

function buildFloatingPurchase(input: FloatingPurchaseInput, id: number): FloatingPurchase {
  const timestamp = new Date().toISOString();
  return {
    id,
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

export function createMemoryStore(seed: Partial<SeedState> = {}): ContentStore {
  const state: SeedState = {
    settings: clone(seed.settings ?? defaultBootstrap.settings),
    mediaAssets: clone(seed.mediaAssets ?? buildSeedState().mediaAssets),
    reviews: clone(seed.reviews ?? buildSeedState().reviews),
    floatingPurchases: clone(seed.floatingPurchases ?? buildSeedState().floatingPurchases),
  };

  return {
    async getBootstrap() {
      const mediaAssets = sortByOrder(state.mediaAssets).filter((item) => item.enabled).map((item) => ({ ...item, resolvedUrl: resolveMediaUrl(item.source) }));
      return {
        settings: clone(state.settings),
        heroImages: mediaAssets.filter((item) => item.section === 'hero'),
        detailImages: mediaAssets.filter((item) => item.section === 'detail'),
        reviews: topReviews(state.reviews).slice(0, 2),
        allReviews: [...state.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        floatingPurchases: sortByOrder(state.floatingPurchases).filter((item) => item.enabled),
      };
    },
    async getAdminBootstrap() {
      const bootstrap = await this.getBootstrap();
      return {
        ...bootstrap,
        authenticated: true,
      };
    },
    async getSiteSettings() {
      return clone(state.settings);
    },
    async updateSiteSettings(input) {
      state.settings = {
        ...state.settings,
        ...clone(input),
        updatedAt: new Date().toISOString(),
      };
      return clone(state.settings);
    },
    async listMediaAssets(section) {
      return sortByOrder(state.mediaAssets)
        .filter((item) => (section ? item.section === section : true))
        .map((item) => ({ ...item, resolvedUrl: resolveMediaUrl(item.source) }));
    },
    async createMediaAsset(input) {
      const item = buildMediaAsset(input, makeId(state.mediaAssets));
      state.mediaAssets.push(item);
      return clone(item);
    },
    async updateMediaAsset(id, input) {
      const index = state.mediaAssets.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const updated = {
        ...state.mediaAssets[index],
        ...clone(input),
        resolvedUrl: resolveMediaUrl(input.source),
        updatedAt: new Date().toISOString(),
      };
      state.mediaAssets[index] = updated;
      return clone(updated);
    },
    async deleteMediaAsset(id) {
      const before = state.mediaAssets.length;
      state.mediaAssets = state.mediaAssets.filter((item) => item.id !== id);
      return state.mediaAssets.length !== before;
    },
    async listReviews() {
      return [...state.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async createReview(input) {
      const item = buildReview(input, makeId(state.reviews));
      state.reviews.push(item);
      return clone(item);
    },
    async updateReview(id, input) {
      const index = state.reviews.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const updated = {
        ...state.reviews[index],
        ...clone(input),
        updatedAt: new Date().toISOString(),
      };
      state.reviews[index] = updated;
      return clone(updated);
    },
    async deleteReview(id) {
      const before = state.reviews.length;
      state.reviews = state.reviews.filter((item) => item.id !== id);
      return state.reviews.length !== before;
    },
    async listFloatingPurchases() {
      return sortByOrder(state.floatingPurchases);
    },
    async createFloatingPurchase(input) {
      const item = buildFloatingPurchase(input, makeId(state.floatingPurchases));
      state.floatingPurchases.push(item);
      return clone(item);
    },
    async updateFloatingPurchase(id, input) {
      const index = state.floatingPurchases.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const updated = {
        ...state.floatingPurchases[index],
        ...clone(input),
        updatedAt: new Date().toISOString(),
      };
      state.floatingPurchases[index] = updated;
      return clone(updated);
    },
    async deleteFloatingPurchase(id) {
      const before = state.floatingPurchases.length;
      state.floatingPurchases = state.floatingPurchases.filter((item) => item.id !== id);
      return state.floatingPurchases.length !== before;
    },
  };
}

export function isTruthy(value: string | undefined) {
  return value === '1' || value === 'true' || value === 'yes';
}

export { defaultBootstrap, defaultSiteSettings };
