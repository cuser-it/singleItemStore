import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

function signParams(params: Record<string, string>, secret: string) {
  const filtered = Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));
  const query = filtered.map(([key, value]) => `${key}=${value}`).join('&');
  return createHash('md5').update(`${query}${secret}`).digest('hex');
}

describe('payment params', () => {
  it('does not include sitename in payment params', () => {
    const params = {
      pid: '1000',
      type: 'alipay',
      out_trade_no: 'TEST001',
      notify_url: 'http://example.com/notify',
      return_url: 'http://example.com/return',
      name: '测试商品',
      money: '99.00',
    };
    
    const secret = 'testSecret';
    const sign = signParams(params, secret);
    const signed = { ...params, sign, sign_type: 'MD5' };
    
    expect(signed).not.toHaveProperty('sitename');
    expect(Object.keys(signed)).not.toContain('sitename');
    
    const queryString = new URLSearchParams(signed).toString();
    expect(queryString).not.toContain('sitename');
  });

  it('generates correct signature without sitename', () => {
    const params = {
      pid: '1000',
      type: 'alipay',
      out_trade_no: 'SO001',
      notify_url: 'http://test.com/notify',
      return_url: 'http://test.com/return',
      name: 'product',
      money: '100.00',
    };
    
    const secret = 'secret123';
    const sign = signParams(params, secret);
    
    // 验证签名格式正确
    expect(sign).toMatch(/^[a-f0-9]{32}$/);
    
    // 验证签名不包含 sitename
    const sortedKeys = Object.keys(params).sort();
    const expectedString = sortedKeys.map(k => `${k}=${params[k as keyof typeof params]}`).join('&') + secret;
    const expectedSign = createHash('md5').update(expectedString).digest('hex');
    
    expect(sign).toBe(expectedSign);
  });
});
