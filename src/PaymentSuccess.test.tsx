import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentSuccess from './PaymentSuccess';

const fetchPaymentSuccessConfig = vi.fn();
vi.mock('./api', () => ({
  fetchPaymentSuccessConfig: (...args: unknown[]) => fetchPaymentSuccessConfig(...args),
}));

function setLocation(path: string) {
  window.history.replaceState({}, '', path);
}

describe('PaymentSuccess page', () => {
  beforeEach(() => {
    fetchPaymentSuccessConfig.mockReset();
    setLocation('/payment/return?orderNo=SO20260904001');
  });

  it('renders order no, strong CS button and light home button when CS is configured', async () => {
    fetchPaymentSuccessConfig.mockResolvedValue({ message: '添加客服领取服用说明', customerServiceUrl: 'weixin://dl/business/?t=abc', customerServiceQrCode: 'https://x/qr.png' });
    render(<PaymentSuccess />);

    expect(await screen.findByTestId('ps-order-no')).toHaveTextContent('SO20260904001');
    expect(screen.getByText('添加客服领取服用说明')).toBeInTheDocument();
    const cs = screen.getByRole('button', { name: /添加客服微信/ });
    const home = screen.getByRole('button', { name: /返回首页/ });
    expect(cs).toHaveClass('ps-btn--primary');
    expect(home).toHaveClass('ps-btn--ghost');
  });

  it('second reminder: leaving without contacting CS shows a reminder instead of navigating', async () => {
    fetchPaymentSuccessConfig.mockResolvedValue({ message: 'msg', customerServiceUrl: 'weixin://dl/business/?t=abc', customerServiceQrCode: '' });
    const user = userEvent.setup();
    render(<PaymentSuccess />);
    await screen.findByTestId('ps-order-no');

    await user.click(screen.getByRole('button', { name: /返回首页/ }));
    expect(screen.getByRole('alertdialog', { name: '添加客服提醒' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/payment/return');

    // 从提醒里选择立即添加 → 打开客服弹窗
    await user.click(screen.getByRole('button', { name: /立即添加客服/ }));
    expect(await screen.findByRole('link', { name: /点击添加客服微信/ })).toHaveAttribute('href', 'weixin://dl/business/?t=abc');
  });

  it('second reminder: "暂不添加" navigates home via SPA routing (pathname only, origin untouched)', async () => {
    fetchPaymentSuccessConfig.mockResolvedValue({ message: 'msg', customerServiceUrl: 'weixin://dl/business/?t=abc', customerServiceQrCode: '' });
    const user = userEvent.setup();
    const originBefore = window.location.origin;
    const popstate = vi.fn();
    window.addEventListener('popstate', popstate);
    render(<PaymentSuccess />);
    await screen.findByTestId('ps-order-no');

    await user.click(screen.getByRole('button', { name: /返回首页/ }));
    await user.click(screen.getByRole('button', { name: /暂不添加，返回首页/ }));

    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('');
    expect(window.location.origin).toBe(originBefore);
    expect(popstate).toHaveBeenCalled();
    window.removeEventListener('popstate', popstate);
  });

  it('after opening CS, 返回首页 goes home directly without reminder', async () => {
    fetchPaymentSuccessConfig.mockResolvedValue({ message: 'msg', customerServiceUrl: '', customerServiceQrCode: 'https://x/qr.png' });
    const user = userEvent.setup();
    render(<PaymentSuccess />);
    await screen.findByTestId('ps-order-no');

    await user.click(screen.getByRole('button', { name: /添加客服微信/ }));
    expect(await screen.findByTestId('cs-longpress-hint')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: /返回首页/ }));
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('without CS config: only a primary 返回首页 button, no reminder', async () => {
    fetchPaymentSuccessConfig.mockResolvedValue({ message: 'msg', customerServiceUrl: '', customerServiceQrCode: '' });
    const user = userEvent.setup();
    render(<PaymentSuccess />);
    await screen.findByTestId('ps-order-no');

    expect(screen.queryByRole('button', { name: /添加客服微信/ })).toBeNull();
    const home = screen.getByRole('button', { name: /返回首页/ });
    expect(home).toHaveClass('ps-btn--primary');
    await user.click(home);
    expect(window.location.pathname).toBe('/');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
