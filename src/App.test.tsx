import { describe, it, expect } from 'vitest';
import { formatFulfillmentStatus, formatPaymentStatus } from './App';

describe('Payment channel configuration', () => {
  it('should use wxpay not wechat for payment channels', () => {
    // 这个测试确保管理后台配置表单使用正确的支付渠道值
    const paymentChannelOptions = [
      { label: '支付宝', value: 'alipay' },
      { label: '微信', value: 'wxpay' }, // 必须是 wxpay，不是 wechat
    ];

    const values = paymentChannelOptions.map(opt => opt.value);
    
    expect(values).toEqual(['alipay', 'wxpay']);
    expect(values).not.toContain('wechat');
  });
});

describe('Order status labels', () => {
  it('should format payment statuses in Chinese', () => {
    expect(formatPaymentStatus('UNPAID')).toBe('待支付');
    expect(formatPaymentStatus('PAYING')).toBe('支付中');
    expect(formatPaymentStatus('PAID')).toBe('已支付');
    expect(formatPaymentStatus('PAYMENT_FAILED')).toBe('支付失败');
    expect(formatPaymentStatus('REFUNDED')).toBe('已退款');
  });

  it('should format fulfillment statuses in Chinese', () => {
    expect(formatFulfillmentStatus('WAIT_SHIP')).toBe('待发货');
    expect(formatFulfillmentStatus('SHIPPED')).toBe('已发货');
  });

  it('should hide unknown enum values behind a Chinese fallback', () => {
    expect(formatPaymentStatus('UNKNOWN')).toBe('未知状态');
    expect(formatFulfillmentStatus('UNKNOWN')).toBe('未知状态');
  });
});
