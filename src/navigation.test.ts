import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { paymentResultPath, redirectToPayment } from './navigation';

describe('跳转第三方收银台', () => {
  let assign: ReturnType<typeof vi.fn>;
  const realWindow = window;

  beforeEach(() => {
    realWindow.history.replaceState({}, '', '/');
    assign = vi.fn();
    // jsdom 的 Location.assign 不可重定义；替换测试全局而非修改原生 Location。
    vi.stubGlobal('window', {
      history: realWindow.history,
      location: {
        assign,
        get pathname() { return realWindow.location.pathname; },
        get search() { return realWindow.location.search; },
      },
      open: realWindow.open,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('支付结果页路径带上订单号并做转义', () => {
    expect(paymentResultPath('SO2026 001')).toBe('/payment/return?orderNo=SO2026%20001');
  });

  // 回归：原来用 window.open(paymentUrl, '_blank')，微信内会新开 webview，
  // 支付完成后微信关闭该 webview，用户被直接弹回聊天界面，再也回不到支付结果页
  it('同窗跳转支付页，且先把支付结果页压入 history', () => {
    const openSpy = vi.spyOn(window, 'open');

    redirectToPayment('https://pay.example.com/submit?x=1', 'SO20260904001');

    // 支付前当前历史条目已经是我们的结果页：微信里回退时能落回来
    expect(window.location.pathname).toBe('/payment/return');
    expect(window.location.search).toBe('?orderNo=SO20260904001');
    expect(assign).toHaveBeenCalledWith('https://pay.example.com/submit?x=1');
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });
});
