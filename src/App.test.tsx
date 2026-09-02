import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultBootstrap } from '../shared/site';

const adminBootstrap = {
  ...defaultBootstrap,
  authenticated: true as const,
  sites: [defaultBootstrap.site, { ...defaultBootstrap.site, id: 2, name: '第二站点', slug: 'second-site', isActive: false }],
  activeSiteId: defaultBootstrap.site.id,
};
vi.mock('./api', () => ({
  activateSite: vi.fn(),
  createFloatingPurchase: vi.fn(),
  createMediaAsset: vi.fn(),
  createReview: vi.fn(),
  createSite: vi.fn(),
  deleteFloatingPurchase: vi.fn(),
  deleteMediaAsset: vi.fn(),
  deleteReview: vi.fn(),
  deleteSite: vi.fn(),
  fetchAdminBootstrap: vi.fn(),
  fetchAdminMe: vi.fn(),
  fetchPublicBootstrap: vi.fn(),
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
  saveSiteSettings: vi.fn(),
  updateFloatingPurchase: vi.fn(),
  updateMediaAsset: vi.fn(),
  updateReview: vi.fn(),
  updateSite: vi.fn(),
  uploadAsset: vi.fn(),
}))

import { activateSite, createReview, createSite, deleteFloatingPurchase, deleteMediaAsset, deleteReview, deleteSite, fetchAdminBootstrap, fetchAdminMe, fetchPublicBootstrap, saveSiteSettings, uploadAsset } from './api';
import { App } from './App';

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  vi.mocked(fetchAdminMe).mockResolvedValue(false);
  vi.mocked(fetchAdminBootstrap).mockResolvedValue(adminBootstrap);
  vi.mocked(fetchPublicBootstrap).mockResolvedValue(defaultBootstrap);
  vi.mocked(createSite).mockResolvedValue({ ...defaultBootstrap.site, id: 3, name: '华东商城', slug: 'east-store', isActive: false });
  vi.mocked(activateSite).mockResolvedValue({ ...defaultBootstrap.site, id: 2, name: '第二站点', slug: 'second-site', isActive: true });
  vi.mocked(uploadAsset).mockResolvedValue({ source: '/img/review-upload.jpg', resolvedUrl: '/img/review-upload.jpg' });
  vi.mocked(createReview).mockResolvedValue({ ...defaultBootstrap.allReviews[0], id: 99, images: ['/img/review-upload.jpg'] });
  vi.mocked(deleteFloatingPurchase).mockResolvedValue(undefined);
  vi.mocked(deleteMediaAsset).mockResolvedValue(undefined);
  vi.mocked(deleteReview).mockResolvedValue(undefined);
  vi.mocked(deleteSite).mockResolvedValue(true);
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 1024px'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('renders the public storefront from API data and keeps the sheets working', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole('heading', { name: defaultBootstrap.settings.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /宝贝评价\(2\).*查看全部/ })).toBeInTheDocument();
    expect(screen.getByText('产品详情')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /宝贝评价\(2\).*查看全部/ }));
    const reviewSheet = screen.getByLabelText('商品评论');
    expect(reviewSheet).toHaveClass('sheet--open');

    await user.click(within(reviewSheet).getByRole('button', { name: '关闭商品评论' }));
    await user.click(screen.getByRole('button', { name: '立即发货' }));

    expect(screen.getByLabelText('确认订单')).toHaveClass('sheet--open');
  });

  it('uses backend site prices in the SVG price banner', async () => {
    vi.mocked(fetchPublicBootstrap).mockResolvedValue({
      ...defaultBootstrap,
      settings: {
        ...defaultBootstrap.settings,
        salePrice: 123,
        originalPrice: 456,
      },
    });

    render(<App />);

    expect(await screen.findByText('¥123.0')).toBeInTheDocument();
    expect(screen.getByText('划线¥456.0')).toBeInTheDocument();
  });

  it('shows the admin login screen on desktop', async () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    window.history.replaceState({}, '', '/admin/login');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '后台登录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByText('后台仅支持桌面端访问，请使用电脑浏览器继续。')).toBeInTheDocument();
  });

  it('renders authenticated admin data and saves site settings through the API', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAdminMe).mockResolvedValue(true);
    vi.mocked(saveSiteSettings).mockResolvedValue(defaultBootstrap.settings);
    window.history.replaceState({}, '', '/admin');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    expect(screen.getByText('图片总数')).toBeInTheDocument();
    expect(screen.getByText('评价总数')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /评价管理/ }));
    expect(await screen.findByRole('heading', { name: '评价管理' })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('输入用户名...'), defaultBootstrap.allReviews[0].name);
    expect(screen.getByText(defaultBootstrap.allReviews[0].content)).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /站点管理/ }));
    await user.click(screen.getByRole('button', { name: '编辑当前配置' }));
    await user.click(screen.getByRole('button', { name: '保存配置' }));

    expect(saveSiteSettings).toHaveBeenCalledWith(expect.objectContaining({ shopName: defaultBootstrap.settings.shopName }));
  });
  it('creates and switches sites from the admin site center', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAdminMe).mockResolvedValue(true);
    window.history.replaceState({}, '', '/admin');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /站点管理/ }));
    expect(await screen.findByRole('heading', { name: '站点管理中心' })).toBeInTheDocument();
    expect(screen.getByText('第二站点')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '新建站点' }));
    await user.type(screen.getByPlaceholderText('例如 华东商城'), '华东商城');
    await user.type(screen.getByPlaceholderText('例如 east-store'), 'east-store');
    await user.click(screen.getByRole('button', { name: '创建站点' }));

    expect(createSite).toHaveBeenCalledWith(expect.objectContaining({ name: '华东商城', slug: 'east-store', templateSiteId: defaultBootstrap.site.id }));

    await user.click(screen.getAllByRole('button', { name: '切换' })[0]);
    expect(activateSite).toHaveBeenCalledWith(2);
  });

  it('deletes a media asset after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAdminMe).mockResolvedValue(true);
    window.history.replaceState({}, '', '/admin');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /图片管理/ }));
    expect(await screen.findByRole('heading', { name: '图片管理' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '删除' })[0]);
    await user.click(await screen.findByRole('button', { name: '确认删除' }));

    expect(deleteMediaAsset).toHaveBeenCalledWith(defaultBootstrap.heroImages[0].id);
  });

  it('deletes a floating purchase after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAdminMe).mockResolvedValue(true);
    window.history.replaceState({}, '', '/admin');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /浮层文案管理/ }));
    expect(await screen.findByRole('heading', { name: '浮层文案管理' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '删除' })[0]);
    await user.click(await screen.findByRole('button', { name: '确认删除' }));

    expect(deleteFloatingPurchase).toHaveBeenCalledWith(defaultBootstrap.floatingPurchases[0].id);
  });

  it('deletes a non-active site after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAdminMe).mockResolvedValue(true);
    window.history.replaceState({}, '', '/admin');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /站点管理/ }));
    expect(await screen.findByRole('heading', { name: '站点管理中心' })).toBeInTheDocument();

    const secondSiteRow = screen.getByText('第二站点').closest('tr');
    expect(secondSiteRow).not.toBeNull();
    await user.click(within(secondSiteRow as HTMLElement).getByRole('button', { name: '删除' }));
    await user.click(await screen.findByRole('button', { name: '确认删除' }));

    expect(deleteSite).toHaveBeenCalledWith(2);
  });

  it('uploads a review image and fills the returned link before saving', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAdminMe).mockResolvedValue(true);
    window.history.replaceState({}, '', '/admin');
    const { container } = render(<App />);

    expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /评价管理/ }));
    await user.click(await screen.findByRole('button', { name: '添加评价' }));
    await user.type(screen.getByLabelText('用户名'), '新用户');
    await user.type(screen.getByLabelText('内容'), '这是一条新评价');

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput!, new File(['image'], 'review.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByDisplayValue('/img/review-upload.jpg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '新增评价' }));

    expect(uploadAsset).toHaveBeenCalled();
    expect(createReview).toHaveBeenCalledWith(expect.objectContaining({ images: ['/img/review-upload.jpg'] }));
  });

  it('deletes a review after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAdminMe).mockResolvedValue(true);
    window.history.replaceState({}, '', '/admin');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /评价管理/ }));
    expect(await screen.findByRole('heading', { name: '评价管理' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '删除' })[0]);
    await user.click(await screen.findByRole('button', { name: '确认删除' }));

    expect(deleteReview).toHaveBeenCalledWith(defaultBootstrap.allReviews[0].id);
  });

  it('blocks admin pages on mobile', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    });
    window.matchMedia = ((query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    window.history.replaceState({}, '', '/admin');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '请使用桌面浏览器访问管理页' })).toBeInTheDocument();
    expect(screen.queryByText('后台登录')).toBeNull();
    expect(screen.queryByRole('button', { name: '登录' })).toBeNull();
  });
});
