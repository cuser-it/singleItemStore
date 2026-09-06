import type { AdminBootstrap, FloatingPurchase, MediaAsset, PublicBootstrap, Review, Site, SiteInput, SiteSettings, SiteSettingsUpdateInput, SiteUpdateInput } from '../shared/site';
import type { CreateOrderInput, Order, OrderListResult, PaymentCreateResult, PaymentSettings, PaymentSettingsInput, ProductSku, ProductSkuInput } from '../shared/order';

export type AdminMediaKind = 'image' | 'video';
export type AdminHeroMediaMode = 'image' | 'video';

export type AdminMediaAssetInput = {
  siteId?: number | null;
  section: 'hero' | 'detail';
  kind?: AdminMediaKind;
  sourceType: 'upload' | 'url';
  source: string;
  posterSource?: string | null;
  alt: string;
  sortOrder: number;
  enabled: boolean;
};
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

declare global {
  interface Window {
    __BOOTSTRAP_PROMISE__?: Promise<PublicBootstrap>;
    __BOOTSTRAP_SLUG__?: string;
  }
}

export async function fetchPublicBootstrap(slug?: string) {
  // index.html 中的内联脚本会在 JS bundle 加载前提前发起请求（LCP 优化），
  // slug 一致时直接复用；只消费一次，失败则回退到正常请求
  const preloaded = typeof window !== 'undefined' ? window.__BOOTSTRAP_PROMISE__ : undefined;
  if (preloaded && window.__BOOTSTRAP_SLUG__ === (slug ?? '')) {
    delete window.__BOOTSTRAP_PROMISE__;
    try {
      return await preloaded;
    } catch {
      // 预取失败，回退到常规请求
    }
  }
  const url = slug ? `/api/public/bootstrap?slug=${encodeURIComponent(slug)}` : '/api/public/bootstrap';
  return requestJson<PublicBootstrap>(url);
}

export async function fetchAdminBootstrap(siteId?: number | null) {
  const params = siteId != null ? `?siteId=${siteId}` : '';
  return requestJson<AdminBootstrap>(`/api/admin/bootstrap${params}`);
}

export async function fetchAdminMe() {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('admin auth timeout')), 10000));
    await Promise.race([requestJson<{ authenticated: true }>('/api/admin/me'), timeout]);
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

export async function saveSiteSettings(siteId: number | null, input: SiteSettingsUpdateInput) {
  return requestJson<SiteSettings>('/api/admin/site-settings', {
    method: 'PUT',
    body: JSON.stringify({ ...input, siteId }),
  });
}

export async function saveHeroMediaMode(siteId: number | null, mode: AdminHeroMediaMode) {
  return requestJson<{ mode: AdminHeroMediaMode }>('/api/admin/hero-media-mode', {
    method: 'PUT',
    body: JSON.stringify({ siteId, mode }),
  });
}

export async function createMediaAsset(input: AdminMediaAssetInput) {
  return requestJson<MediaAsset>('/api/admin/media-assets', {
    method: 'POST',
    body: JSON.stringify({ kind: 'image', posterSource: null, ...input }),
  });
}

export async function updateMediaAsset(id: number, input: AdminMediaAssetInput) {
  return requestJson<MediaAsset>(`/api/admin/media-assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ kind: 'image', posterSource: null, ...input }),
  });
}

export async function deleteMediaAsset(id: number, siteId?: number | null) {
  const params = siteId != null ? `?siteId=${siteId}` : '';
  return requestJson<void>(`/api/admin/media-assets/${id}${params}`, { method: 'DELETE' });
}

export async function createReview(input: {
  displayDate?: string | null;
  siteId?: number | null;
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

export async function deleteReview(id: number, siteId?: number | null) {
  const params = siteId != null ? `?siteId=${siteId}` : '';
  return requestJson<void>(`/api/admin/reviews/${id}${params}`, { method: 'DELETE' });
}

export async function createFloatingPurchase(input: {
  siteId?: number | null;
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

export async function deleteFloatingPurchase(id: number, siteId?: number | null) {
  const params = siteId != null ? `?siteId=${siteId}` : '';
  return requestJson<void>(`/api/admin/floating-purchases/${id}${params}`, { method: 'DELETE' });
}

export async function uploadAsset(file: File, options: { siteId?: number | null; section?: 'hero' | 'detail'; kind?: AdminMediaKind; purpose?: 'poster'; onProgress?: (percent: number) => void } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  const params = new URLSearchParams();
  if (options.siteId != null) params.set('siteId', String(options.siteId));
  if (options.section) params.set('section', options.section);
  if (options.kind) params.set('kind', options.kind);
  if (options.purpose) params.set('purpose', options.purpose);
  const query = params.toString();
  if (options.onProgress) {
    return new Promise<{ source: string; resolvedUrl: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/admin/upload${query ? `?${query}` : ''}`);
      xhr.withCredentials = true;
      xhr.timeout = 10 * 60 * 1000;
      options.onProgress?.(0);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) options.onProgress?.(Math.min(99, Math.round(event.loaded / event.total * 100)));
      };
      xhr.onerror = () => reject(new Error('上传网络异常，请重试'));
      xhr.ontimeout = () => reject(new Error('上传超时，请重试'));
      xhr.onabort = () => reject(new Error('上传已取消'));
      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300) throw new Error(result.message || `上传失败 (${xhr.status})`);
          if (typeof result.source !== 'string' || typeof result.resolvedUrl !== 'string') throw new Error('上传响应无效');
          options.onProgress?.(100);
          resolve(result);
        } catch (error) { reject(error instanceof Error ? error : new Error('上传失败')); }
      };
      xhr.send(formData);
    });
  }
  return requestJson<{ source: string; resolvedUrl: string }>(`/api/admin/upload${query ? `?${query}` : ''}`, {
    method: 'POST',
    body: formData,
  });
}

export async function fetchAdminSkus(siteId?: number | null) {
  const params = siteId != null ? `?siteId=${siteId}` : '';
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

export async function fetchPaymentSettings() {
  return requestJson<PaymentSettings>('/api/admin/payment-settings');
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

export async function fetchPaymentSuccessConfig(orderNo?: string | null) {
  const params = orderNo ? `?orderNo=${encodeURIComponent(orderNo)}` : '';
  return requestJson<{ message: string; customerServiceUrl: string; customerServiceQrCode?: string }>(`/api/public/payment-success-config${params}`);
}

export type PublicOrderStatus = {
  orderNo: string;
  paymentStatus: Order['paymentStatus'];
  fulfillmentStatus: Order['fulfillmentStatus'];
  totalAmount: string;
};

/** 支付回跳页轮询订单真实支付状态（不依赖网关的 return_url 是否真的跳回来） */
export async function fetchPublicOrderStatus(orderNo: string) {
  return requestJson<PublicOrderStatus>(`/api/public/orders/${encodeURIComponent(orderNo)}/status`);
}
