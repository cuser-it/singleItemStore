import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerServiceModal, { resolveCustomerServiceMode } from './CustomerServiceModal';

describe('resolveCustomerServiceMode', () => {
  it('maps backend config to layout mode', () => {
    expect(resolveCustomerServiceMode('https://x/qr.png', 'weixin://dl/business/?t=abc')).toBe('qr-and-link');
    expect(resolveCustomerServiceMode('https://x/qr.png', '')).toBe('qr-only');
    expect(resolveCustomerServiceMode('', 'weixin://dl/business/?t=abc')).toBe('link-only');
    expect(resolveCustomerServiceMode('  ', undefined)).toBe('none');
  });
});

describe('CustomerServiceModal layouts', () => {
  it('二维码 + 链接：上方二维码，下方带超链接的按钮', () => {
    render(<CustomerServiceModal visible onClose={() => {}} qrCodeUrl="https://x/qr.png" serviceLink="weixin://dl/business/?t=abc" />);
    expect(screen.getByTestId('cs-qr')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /点击直接添加/ });
    expect(link).toHaveAttribute('href', 'weixin://dl/business/?t=abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByTestId('cs-longpress-hint')).toBeNull();
  });

  it('只有二维码：下方改为长按识别的文字提示，没有按钮', () => {
    render(<CustomerServiceModal visible onClose={() => {}} qrCodeUrl="https://x/qr.png" serviceLink="" />);
    expect(screen.getByTestId('cs-qr')).toBeInTheDocument();
    expect(screen.getByTestId('cs-longpress-hint')).toHaveTextContent('长按图片识别二维码，添加我们的微信客服');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('只有链接：不渲染二维码占位，直接显示跳转按钮，点击触发 onContact', async () => {
    const onContact = vi.fn();
    const user = userEvent.setup();
    render(<CustomerServiceModal visible onClose={() => {}} qrCodeUrl="" serviceLink="https://work.weixin.qq.com/kfid/abc" onContact={onContact} />);
    expect(screen.queryByTestId('cs-qr')).toBeNull();
    expect(screen.queryByAltText('客服二维码')).toBeNull();
    const link = screen.getByRole('link', { name: /点击添加客服微信/ });
    expect(link).toHaveAttribute('href', 'https://work.weixin.qq.com/kfid/abc');
    await user.click(link);
    expect(onContact).toHaveBeenCalledTimes(1);
  });
});
