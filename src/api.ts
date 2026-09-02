import type { AdminBootstrap, FloatingPurchase, MediaAsset, PublicBootstrap, Review, Site, SiteInput, SiteSettings, SiteSettingsUpdateInput, SiteUpdateInput } from '../shared/site';

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed with ${response.status}`;
    try {
      const data = JSON.parse(text) as { message?: string };
      message = data.message || message;
    } catch {
      // Keep the raw response when the server did not return JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchPublicBootstrap() {
  return requestJson<PublicBootstrap>('/api/public/bootstrap');
}

export async function fetchAdminBootstrap() {
  return requestJson<AdminBootstrap>('/api/admin/bootstrap');
}

export async function fetchAdminMe() {
  try {
    await requestJson<{ authenticated: true }>('/api/admin/me');
    return true;
  } catch {
    return false;
  }
}

export async function loginAdmin(password: string) {
  return requestJson<{ ok: true }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logoutAdmin() {
  return requestJson<{ ok: true }>('/api/admin/logout', { method: 'POST' });
}

export async function createSite(input: SiteInput) {
  return requestJson<Site>('/api/admin/sites', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSite(id: number, input: SiteUpdateInput) {
  return requestJson<Site>(`/api/admin/sites/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function activateSite(id: number) {
  return requestJson<Site>(`/api/admin/sites/${id}/activate`, { method: 'POST' });
}

export async function saveSiteSettings(input: SiteSettingsUpdateInput) {
  return requestJson<SiteSettings>('/api/admin/site-settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function createMediaAsset(input: {
  section: 'hero' | 'detail';
  sourceType: 'upload' | 'url';
  source: string;
  alt: string;
  sortOrder: number;
  enabled: boolean;
}) {
  return requestJson<MediaAsset>('/api/admin/media-assets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateMediaAsset(id: number, input: Parameters<typeof createMediaAsset>[0]) {
  return requestJson<MediaAsset>(`/api/admin/media-assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteMediaAsset(id: number) {
  return requestJson<void>(`/api/admin/media-assets/${id}`, { method: 'DELETE' });
}

export async function createReview(input: {
  name: string;
  content: string;
  images: string[];
  featuredOnHome: boolean;
  homeOrder: number;
  enabled: boolean;
}) {
  return requestJson<Review>('/api/admin/reviews', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateReview(id: number, input: Parameters<typeof createReview>[0]) {
  return requestJson<Review>(`/api/admin/reviews/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteReview(id: number) {
  return requestJson<void>(`/api/admin/reviews/${id}`, { method: 'DELETE' });
}

export async function createFloatingPurchase(input: {
  content: string;
  enabled: boolean;
  sortOrder: number;
}) {
  return requestJson<FloatingPurchase>('/api/admin/floating-purchases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateFloatingPurchase(id: number, input: Parameters<typeof createFloatingPurchase>[0]) {
  return requestJson<FloatingPurchase>(`/api/admin/floating-purchases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteFloatingPurchase(id: number) {
  return requestJson<void>(`/api/admin/floating-purchases/${id}`, { method: 'DELETE' });
}

export async function uploadAsset(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestJson<{ source: string; resolvedUrl: string }>('/api/admin/upload', {
    method: 'POST',
    body: formData,
  });
}
