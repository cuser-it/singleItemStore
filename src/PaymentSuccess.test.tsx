import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentSuccess from './PaymentSuccess';

const fetchPaymentSuccessConfig = vi.fn();
const fetchPublicOrderStatus = vi.fn();
vi.mock('./api', () => ({
  fetchPaymentSuccessConfig: (...args: unknown[]) => fetchPaymentSuccessConfig(...args),
  fetchPublicOrderStatus: (...args: unknown[]) => fetchPublicOrderStatus(...args),
}));

function setLocation(path: string) {
  window.history.replaceState({}, '', path);
}

describe('PaymentSuccess page', () => {
  beforeEach(() => {
    fetchPaymentSuccessConfig.mockReset();
    fetchPublicOrderStatus.mockReset();
    // 默认按已支付返回，保持原有用例语义
    fetchPublicOrderStatus.mockResolvedValue({ orderNo: 'SO20260904001', paymentStatus: 'PAID', fulfillmentStatus: 'WAIT_SHIP', totalAmount: '99.00' });
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

  // 回归：微信内 H5 支付完成后往往不会走网关 return_url，“落地即成功”会把未付款误展示为支付成功
  it('订单仍未支付时展示“支付确认中”，不谎称支付成功', async () => {
    fetchPaymentSuccessConfig.mockResolvedValue({ message: 'msg', customerServiceUrl: '', customerServiceQrCode: 'https://x/qr.png' });
    fetchPublicOrderStatus.mockResolvedValue({ orderNo: 'SO20260904001', paymentStatus: 'UNPAID', fulfillmentStatus: 'WAIT_SHIP', totalAmount: '99.00' });
    render(<PaymentSuccess />);

    expect(await screen.findByText('支付确认中')).toBeInTheDocument();
    expect(screen.queryByText('支付成功')).toBeNull();
    // 未支付时不应引导加客服
    expect(screen.queryByRole('button', { name: /添加客服微信/ })).toBeNull();
    expect(screen.getByRole('button', { name: /我已完成支付，刷新状态/ })).toBeInTheDocument();
  });

  it('支付失败时展示失败文案，且返回首页不再拦截挽留', async () => {
    fetchPaymentSuccessConfig.mockResolvedValue({ message: 'msg', customerServiceUrl: 'weixin://dl/business/?t=abc', customerServiceQrCode: '' });
    fetchPublicOrderStatus.mockResolvedValue({ orderNo: 'SO20260904001', paymentStatus: 'PAYMENT_FAILED', fulfillmentStatus: 'WAIT_SHIP', totalAmount: '99.00' });
    const user = userEvent.setup();
    render(<PaymentSuccess />);

    expect(await screen.findByText('支付未完成')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /返回首页/ }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(window.location.pathname).toBe('/');
  });

  it('点“我已完成支付，刷新状态”会重新查询并切到成功页', async () => {
    fetchPaymentSuccessConfig.mockResolvedValue({ message: 'msg', customerServiceUrl: '', customerServiceQrCode: '' });
    fetchPublicOrderStatus.mockResolvedValueOnce({ orderNo: 'SO20260904001', paymentStatus: 'UNPAID', fulfillmentStatus: 'WAIT_SHIP', totalAmount: '99.00' });
    fetchPublicOrderStatus.mockResolvedValue({ orderNo: 'SO20260904001', paymentStatus: 'PAID', fulfillmentStatus: 'WAIT_SHIP', totalAmount: '99.00' });
    const user = userEvent.setup();
    render(<PaymentSuccess />);

    await screen.findByText('支付确认中');
    await user.click(screen.getByRole('button', { name: /我已完成支付，刷新状态/ }));
    expect(await screen.findByText('支付成功')).toBeInTheDocument();
  });

  it('状态接口失败时不误报成功，而是停在确认中', async () => {
    fetchPaymentSuccessConfig.mockResolvedValue({ message: 'msg', customerServiceUrl: '', customerServiceQrCode: '' });
    fetchPublicOrderStatus.mockRejectedValue(new Error('network down'));
    render(<PaymentSuccess />);

    expect(await screen.findByText('支付确认中')).toBeInTheDocument();
  });
});
