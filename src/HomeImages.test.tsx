import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import bootstrapFixture from './test/publicBootstrap.fixture.json';
import type { PublicBootstrap } from '../shared/site';

vi.mock('./api', () => ({
  fetchPublicBootstrap: vi.fn(async () => bootstrapFixture as unknown as PublicBootstrap),
  createOrder: vi.fn(),
  queryPublicOrder: vi.fn(),
}));

const { App } = await import('./App');

/**
 * 回归测试：antd 6 的 `placeholder={{ progress: true }}` 只渲染 Progress 占位层，
 * 会直接丢弃 src，导致首页所有图片都没有 <img>。这里断言四类图片的真实链接都渲染出来。
 */
describe('首页图片渲染', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('轮播图渲染真实图片链接', async () => {
    const { container } = render(<App />);

    await waitFor(() => expect(container.querySelector('.slides')).not.toBeNull());
    const slides = container.querySelector('.slides') as HTMLElement;
    const hero = within(slides).getByAltText('轮播图1');
    expect(hero.tagName).toBe('IMG');
    expect(hero).toHaveAttribute('src', 'https://cdn.example.com/hero-1.png');
  });

  it('评价图渲染真实图片链接', async () => {
    render(<App />);

    const reviewImage = await screen.findByAltText('王长海评价图1');
    expect(reviewImage).toHaveAttribute('src', 'https://cdn.example.com/review-1.jpg');
  });

  it('产品详情图渲染真实图片链接', async () => {
    render(<App />);

    const detailImage = await screen.findByAltText('详情图1');
    expect(detailImage).toHaveAttribute('src', 'https://cdn.example.com/detail-1.png');
  });

  it('评价详情弹层里的图片渲染真实图片链接', async () => {
    render(<App />);

    const entry = await screen.findByRole('button', { name: /查看全部/ });
    await userEvent.click(entry);

    const sheetImage = await screen.findByAltText('王长海图片评论');
    expect(sheetImage).toHaveAttribute('src', 'https://cdn.example.com/review-detail-1.jpg');
  });

  it('页面上不存在丢失 src 的图片占位', async () => {
    const { container } = render(<App />);

    await waitFor(() => expect(container.querySelector('.slides img')).not.toBeNull());
    const emptySrc = Array.from(container.querySelectorAll('.ant-image img')).filter(
      (img) => !img.getAttribute('src'),
    );
    expect(emptySrc).toHaveLength(0);
  });
});
