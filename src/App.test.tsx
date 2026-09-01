import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

describe('App', () => {
  it('renders the reference storefront layout', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /参茸 养心益肾胶囊/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /宝贝评价\(12083\).*查看全部/ })).toBeInTheDocument();
    expect(screen.getByText('产品详情')).toBeInTheDocument();
    expect(screen.getByText('用户下单')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '立即发货' })).toBeInTheDocument();
  });

  it('updates sku and quantity totals', async () => {
    const user = userEvent.setup();
    render(<App />);

    const buySection = document.querySelector('#buy');
    expect(buySection).not.toBeNull();

    await user.click(within(buySection as HTMLElement).getByRole('radio', { name: '3盒 稳定装-持续输出' }));
    await user.click(within(buySection as HTMLElement).getByRole('button', { name: '增加数量' }));

    expect(within(buySection as HTMLElement).getByText('¥536.0')).toBeInTheDocument();
    expect(screen.getByText('券后¥268.0起')).toBeInTheDocument();
  });

  it('opens review and checkout sheets', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /宝贝评价\(12083\).*查看全部/ }));
    const reviewSheet = screen.getByLabelText('商品评论');
    expect(reviewSheet).toHaveClass('sheet--open');

    await user.click(within(reviewSheet).getByRole('button', { name: '关闭商品评论' }));
    await user.click(screen.getByRole('button', { name: '立即发货' }));

    expect(screen.getByLabelText('确认订单')).toHaveClass('sheet--open');

    await user.click(screen.getByRole('button', { name: '提交订单' }));
    expect(screen.getByText('已选择微信支付，订单已进入演示提交流程')).toBeInTheDocument();
  });
});
