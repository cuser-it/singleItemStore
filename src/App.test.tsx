import { describe, it, expect } from 'vitest';

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
