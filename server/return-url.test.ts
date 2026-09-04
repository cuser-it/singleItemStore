import { describe, expect, it } from 'vitest';
import { resolveReturnUrl } from './orders';

describe('resolveReturnUrl（支付同步跳转地址）', () => {
  it('相对路径 + 请求 Origin → 使用用户当前访问的域名与端口', () => {
    expect(resolveReturnUrl('/payment/return', 'http://localhost:5174', 'SO001')).toBe('http://localhost:5174/payment/return?orderNo=SO001');
  });

  it('后台配置了写死端口的绝对地址时，仍以请求 Origin 为准（只取路径）', () => {
    expect(resolveReturnUrl('http://localhost:5173/payment/return', 'http://localhost:5174', 'SO002')).toBe('http://localhost:5174/payment/return?orderNo=SO002');
    expect(resolveReturnUrl('http://old.example.com/payment/return?from=pay', 'https://shop.example.com', 'SO003')).toBe('https://shop.example.com/payment/return?from=pay&orderNo=SO003');
  });

  it('没有 Origin 时退回配置值原样使用', () => {
    expect(resolveReturnUrl('https://shop.example.com/payment/return', undefined, 'SO004')).toBe('https://shop.example.com/payment/return?orderNo=SO004');
    expect(resolveReturnUrl('/payment/return', undefined, 'SO005')).toBe('/payment/return?orderNo=SO005');
  });

  it('Origin 非法或配置为空时有安全兜底', () => {
    expect(resolveReturnUrl('', 'http://127.0.0.1:5174', 'SO006')).toBe('http://127.0.0.1:5174/payment/return?orderNo=SO006');
    expect(resolveReturnUrl('/payment/return', 'not-a-url', 'SO007')).toBe('/payment/return?orderNo=SO007');
    expect(resolveReturnUrl('/payment/return', 'ftp://evil.example.com', 'SO008')).toBe('/payment/return?orderNo=SO008');
  });

  it('orderNo 会被正确编码', () => {
    expect(resolveReturnUrl('/payment/return', 'http://localhost:5174', 'A B&C')).toBe('http://localhost:5174/payment/return?orderNo=A+B%26C');
  });
});
