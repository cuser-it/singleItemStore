import type { MediaAsset, MediaAssetInput, MediaKind, MediaSection, SiteSettings } from './site';

export class ContentValidationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function validateDisplayDate(value: unknown): asserts value is string | null | undefined {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    throw new ContentValidationError('displayDate must be YYYY-MM-DD or null');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ContentValidationError('displayDate must be a valid calendar date');
  }
}

export function validateMediaModeWrite(section: MediaSection, kind: MediaKind, settings: SiteSettings) {
  if (!['hero', 'detail'].includes(section) || !['image', 'video'].includes(kind)) throw new ContentValidationError('invalid section or kind');
  if (section === 'detail' && kind !== 'image') throw new ContentValidationError('detail only supports images');
  if (section === 'hero' && kind !== (settings.heroMediaMode ?? 'image')) throw new ContentValidationError('inactive hero media mode', 409);
}

export function validateMediaWrite(input: MediaAssetInput, settings: SiteSettings, assets: MediaAsset[], id?: number) {
  const kind = input.kind ?? 'image';
  validateMediaModeWrite(input.section, kind, settings);
  if (input.posterSource != null && typeof input.posterSource !== 'string') throw new ContentValidationError('invalid posterSource');
  if (input.section === 'hero') {
    const count = assets.filter(asset => asset.siteId === settings.siteId && asset.section === 'hero' && (asset.kind ?? 'image') === kind && asset.id !== id).length;
    if (count >= (kind === 'video' ? 1 : 15)) throw new ContentValidationError(kind === 'video' ? 'hero supports at most 1 video' : 'hero supports at most 15 images', 409);
  }
}
