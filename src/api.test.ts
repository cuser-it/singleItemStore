import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PublicBootstrap } from '../shared/site';
import { fetchPublicBootstrap, saveHeroMediaMode, uploadAsset } from './api';

const FAKE_BOOTSTRAP = { site: { id: 1 } } as unknown as PublicBootstrap;

describe('fetchPublicBootstrap 预取消费（LCP 优化）', () => {
  beforeEach(() => {
    delete window.__BOOTSTRAP_PROMISE__;
    delete window.__BOOTSTRAP_SLUG__;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.__BOOTSTRAP_PROMISE__;
    delete window.__BOOTSTRAP_SLUG__;
  });

  it('slug 匹配时直接复用 index.html 预取的 Promise，不再发起 fetch', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    window.__BOOTSTRAP_SLUG__ = '';
    window.__BOOTSTRAP_PROMISE__ = Promise.resolve(FAKE_BOOTSTRAP);

    const result = await fetchPublicBootstrap();

    expect(result).toBe(FAKE_BOOTSTRAP);
    expect(fetchSpy).not.toHaveBeenCalled();
    // 只消费一次，避免二次调用拿到过期数据
    expect(window.__BOOTSTRAP_PROMISE__).toBeUndefined();
  });

  it('slug 不匹配时忽略预取结果，走常规请求', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(FAKE_BOOTSTRAP), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    window.__BOOTSTRAP_SLUG__ = 'shop-a';
    window.__BOOTSTRAP_PROMISE__ = Promise.resolve({} as PublicBootstrap);

    const result = await fetchPublicBootstrap('shop-b');

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toContain('slug=shop-b');
    expect(result).toEqual(FAKE_BOOTSTRAP);
  });

  it('预取失败时回退到常规请求', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(FAKE_BOOTSTRAP), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    window.__BOOTSTRAP_SLUG__ = '';
    const failed = Promise.reject(new Error('network down'));
    failed.catch(() => {});
    window.__BOOTSTRAP_PROMISE__ = failed;

    const result = await fetchPublicBootstrap();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result).toEqual(FAKE_BOOTSTRAP);
  });

  it('保存首页媒体模式发送 siteId 和 mode', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({ mode: 'video' }), { status: 200 }));
    await saveHeroMediaMode(7, 'video');
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/admin/hero-media-mode');
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({ siteId: 7, mode: 'video' });
  });

  it('上传接口支持媒体 query 参数并兼容旧调用', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({ source: '/poster.webp', resolvedUrl: '/poster.webp' }), { status: 200 }));
    await uploadAsset(new File(['x'], 'poster.webp'), { siteId: 2, section: 'hero', kind: 'image', purpose: 'poster' });
    expect(String(fetchSpy.mock.calls[0][0])).toBe('/api/admin/upload?siteId=2&section=hero&kind=image&purpose=poster');
  });
});
