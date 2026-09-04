import type { AdminBootstrap, FloatingPurchase, MediaAsset, PublicBootstrap, Review, Site, SiteInput, SiteSettings, SiteSettingsUpdateInput, SiteUpdateInput } from '../shared/site';
import type { CreateOrderInput, Order, OrderListResult, PaymentCreateResult, PaymentSettings, PaymentSettingsInput, ProductSku, ProductSkuInput } from '../shared/order';

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

export async function fetchPublicBootstrap(slug?: string) {
  const url = slug ? `/api/public/bootstrap?slug=${encodeURIComponent(slug)}` : '/api/public/bootstrap';
  return requestJson<PublicBootstrap>(url);
}

export async function fetchAdminBootstrap(siteId?: number) {
  const params = siteId ? `?siteId=${siteId}` : '';
  return requestJson<AdminBootstrap>(`/api/admin/bootstrap${params}`);
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

export async function deleteSite(id: number) {
  return requestJson<void>(`/api/admin/sites/${id}`, { method: 'DELETE' });
}

export async function activateSite(id: number) {
  return requestJson<Site>(`/api/admin/sites/${id}/activate`, { method: 'POST' });
}

export async function saveSiteSettings(siteId: number, input: SiteSettingsUpdateInput) {
  return requestJson<SiteSettings>('/api/admin/site-settings', {
    method: 'PUT',
    body: JSON.stringify({ ...input, siteId }),
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

export async function fetchAdminSkus(siteId?: number) {
  const params = siteId ? `?siteId=${siteId}` : '';
  return requestJson<ProductSku[]>(`/api/admin/skus${params}`);
}

export async function createSku(input: ProductSkuInput) {
  return requestJson<ProductSku>('/api/admin/skus', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSku(id: number, input: ProductSkuInput) {
  return requestJson<ProductSku>(`/api/admin/skus/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function enableSku(id: number) {
  return requestJson<void>(`/api/admin/skus/${id}/enable`, { method: 'PATCH' });
}

export async function disableSku(id: number) {
  return requestJson<void>(`/api/admin/skus/${id}/disable`, { method: 'PATCH' });
}

export async function deleteSku(id: number) {
  return requestJson<void>(`/api/admin/skus/${id}`, { method: 'DELETE' });
}

export async function createOrder(input: CreateOrderInput) {
  return requestJson<PaymentCreateResult>('/api/public/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function queryPublicOrder(orderNo: string, phone: string) {
  return requestJson<Order>(`/api/public/orders/${encodeURIComponent(orderNo)}?phone=${encodeURIComponent(phone)}`);
}

export async function fetchAdminOrders(params: URLSearchParams = new URLSearchParams()) {
  return requestJson<OrderListResult>(`/api/admin/orders?${params.toString()}`);
}

export async function fetchAdminOrder(id: number) {
  return requestJson<{ order: Order; timeline: Array<{ id: number; action: string; summary: string; actor: string; createdAt: string }> }>(`/api/admin/orders/${id}`);
}

export async function shipOrder(id: number, input: { logisticsCompany: string; logisticsNo: string }) {
  return requestJson<Order>(`/api/admin/orders/${id}/ship`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function markOrderRefunded(id: number, refundNote: string) {
  return requestJson<Order>(`/api/admin/orders/${id}/refund-mark`, {
    method: 'POST',
    body: JSON.stringify({ refundNote }),
  });
}

export async function softDeleteOrder(id: number, deletionReason: string) {
  return requestJson<Order>(`/api/admin/orders/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ deletionReason }),
  });
}

export async function fetchPaymentSettings(siteId?: number) {
  const params = siteId ? `?siteId=${siteId}` : '';
  return requestJson<PaymentSettings>(`/api/admin/payment-settings${params}`);
}

export async function fetchSiteSettings(siteId: number) {
  return requestJson<SiteSettings>(`/api/admin/sites/${siteId}/settings`);
}

export async function savePaymentSettings(input: PaymentSettingsInput) {
  return requestJson<PaymentSettings>('/api/admin/payment-settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function exportOrders(params: URLSearchParams) {
  const response = await fetch(`/api/admin/orders/export?${params.toString()}`, { credentials: 'include' });
  if (!response.ok) throw new Error(await response.text());
  return response.blob();
}

export async function fetchPaymentSuccessConfig() {
  return requestJson<{ message: string; customerServiceUrl: string; customerServiceQrCode?: string }>('/api/public/payment-success-config');
}
