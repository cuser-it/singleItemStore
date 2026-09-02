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
    expect(screen.getByRole('button', { name: '立即发货' })).toBeInTheDocument();
    expect(document.querySelector('#buy')).toBeNull();
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
