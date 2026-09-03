import { describe, it, expect, beforeEach } from 'vitest';
import { getPageKey, ADMIN_ROUTES } from './AdminRouter';

describe('AdminRouter', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('应该从路径中提取正确的页面 key', () => {
    expect(getPageKey('/dashboard')).toBe('dashboard');
    expect(getPageKey('/orders')).toBe('orders');
    expect(getPageKey('/skus')).toBe('skus');
    expect(getPageKey('/payment')).toBe('payment');
    expect(getPageKey('/settings')).toBe('settings');
    expect(getPageKey('/media')).toBe('media');
    expect(getPageKey('/reviews')).toBe('reviews');
    expect(getPageKey('/purchases')).toBe('purchases');
  });

  it('空路径应该返回默认的 dashboard', () => {
    expect(getPageKey('')).toBe('dashboard');
    expect(getPageKey('/')).toBe('dashboard');
  });

  it('路由常量应该正确定义', () => {
    expect(ADMIN_ROUTES.DASHBOARD).toBe('/dashboard');
    expect(ADMIN_ROUTES.ORDERS).toBe('/orders');
    expect(ADMIN_ROUTES.SKUS).toBe('/skus');
    expect(ADMIN_ROUTES.PAYMENT).toBe('/payment');
    expect(ADMIN_ROUTES.SETTINGS).toBe('/settings');
    expect(ADMIN_ROUTES.MEDIA).toBe('/media');
    expect(ADMIN_ROUTES.REVIEWS).toBe('/reviews');
    expect(ADMIN_ROUTES.PURCHASES).toBe('/purchases');
  });
});
