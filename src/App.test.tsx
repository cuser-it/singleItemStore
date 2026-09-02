import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultBootstrap } from '../shared/site';

vi.mock('./api', () => ({
  createFloatingPurchase: vi.fn(),
  createMediaAsset: vi.fn(),
  createReview: vi.fn(),
  deleteFloatingPurchase: vi.fn(),
  deleteMediaAsset: vi.fn(),
  deleteReview: vi.fn(),
  fetchAdminBootstrap: vi.fn().mockResolvedValue({ ...defaultBootstrap, authenticated: true }),
  fetchAdminMe: vi.fn().mockResolvedValue(false),
  fetchPublicBootstrap: vi.fn().mockResolvedValue(defaultBootstrap),
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
  saveSiteSettings: vi.fn(),
  updateFloatingPurchase: vi.fn(),
  updateMediaAsset: vi.fn(),
  updateReview: vi.fn(),
  uploadAsset: vi.fn(),
}));

import { App } from './App';

beforeEach(() => {
  window.history.replaceState({}, '', '/');
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

  it('shows the admin login screen on desktop', async () => {
    window.history.replaceState({}, '', '/admin/login');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '后台登录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByText('后台仅支持桌面端访问，请使用电脑浏览器继续。')).toBeInTheDocument();
  });

  it('blocks admin pages on mobile', async () => {
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
    window.history.replaceState({}, '', '/admin');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '请使用桌面浏览器访问管理页' })).toBeInTheDocument();
    expect(screen.queryByText('后台登录')).toBeNull();
    expect(screen.queryByRole('button', { name: '登录' })).toBeNull();
  });
});
