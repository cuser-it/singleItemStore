import { describe, expect, it } from 'vitest';
import { resolveNotifyUrl, resolveReturnUrl } from './orders';

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

describe('resolveNotifyUrl（支付异步回调地址）', () => {
  it('配置了站点公网地址时，优先用它（而不是买家访问的地址）', () => {
    // 部署后的主场景：买家可能从内网 IP / localhost 访问，但网关回调必须走公网地址
    expect(resolveNotifyUrl('/api/payment/epay/notify', 'http://192.168.1.10:5173', 'https://shop.example.com')).toBe('https://shop.example.com/api/payment/epay/notify');
    expect(resolveNotifyUrl('/api/payment/epay/notify', 'http://localhost:5173', 'http://1.2.3.4:3001')).toBe('http://1.2.3.4:3001/api/payment/epay/notify');
  });

  it('未配置公网地址时，回退为买家访问的域名', () => {
    expect(resolveNotifyUrl('/api/payment/epay/notify', 'https://shop.example.com')).toBe('https://shop.example.com/api/payment/epay/notify');
    expect(resolveNotifyUrl('/api/payment/epay/notify', 'https://shop.example.com', '')).toBe('https://shop.example.com/api/payment/epay/notify');
  });

  it('后台配成 localhost 的绝对地址时，以公网地址为准', () => {
    // 回归：旧实现直接透传配置值，导致支付网关回调到它自己的 localhost，订单永远停在“支付中”
    expect(resolveNotifyUrl('http://localhost:3001/api/payment/epay/notify', undefined, 'https://shop.example.com')).toBe('https://shop.example.com/api/payment/epay/notify');
    expect(resolveNotifyUrl('http://localhost:3001/api/payment/epay/notify', 'https://shop.example.com')).toBe('https://shop.example.com/api/payment/epay/notify');
  });

  it('相对路径 + 请求 Origin → 自动补全为绝对地址', () => {
    expect(resolveNotifyUrl('/api/payment/epay/notify', 'https://shop.example.com')).toBe('https://shop.example.com/api/payment/epay/notify');
    expect(resolveNotifyUrl('', 'http://localhost:5174')).toBe('http://localhost:5174/api/payment/epay/notify');
  });

  it('保留配置中的路径与查询参数', () => {
    expect(resolveNotifyUrl('/custom/notify?channel=epay', 'https://shop.example.com')).toBe('https://shop.example.com/custom/notify?channel=epay');
  });

  it('公网地址非法时忽略它，回退到请求 Origin', () => {
    expect(resolveNotifyUrl('/api/payment/epay/notify', 'https://shop.example.com', 'not-a-url')).toBe('https://shop.example.com/api/payment/epay/notify');
    expect(resolveNotifyUrl('/api/payment/epay/notify', 'https://shop.example.com', 'ftp://evil.example.com')).toBe('https://shop.example.com/api/payment/epay/notify');
  });

  it('没有 Origin 也没有公网地址时退回配置值原样使用', () => {
    expect(resolveNotifyUrl('https://api.example.com/api/payment/epay/notify', undefined)).toBe('https://api.example.com/api/payment/epay/notify');
    expect(resolveNotifyUrl('/api/payment/epay/notify', 'not-a-url')).toBe('/api/payment/epay/notify');
    expect(resolveNotifyUrl('/api/payment/epay/notify', 'ftp://evil.example.com')).toBe('/api/payment/epay/notify');
  });
});

describe('resolveReturnUrl 与站点公网地址', () => {
  it('配置了公网地址时，同步跳转也优先使用它', () => {
    expect(resolveReturnUrl('/payment/return', 'http://192.168.1.10:5173', 'SO100', 'https://shop.example.com')).toBe('https://shop.example.com/payment/return?orderNo=SO100');
  });

  it('公网地址为空时行为与以前一致', () => {
    expect(resolveReturnUrl('/payment/return', 'http://localhost:5174', 'SO101', '')).toBe('http://localhost:5174/payment/return?orderNo=SO101');
  });
});
