/**
 * 纯前端路由跳转：只改变 pathname，不触碰协议/域名/端口。
 * App 通过监听 popstate 的 usePathname() 感知变化并重新渲染对应页面。
 */
export function navigateTo(path: string) {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname + window.location.search !== target) {
    window.history.pushState({}, '', target);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateHome() {
  navigateTo('/');
}

/** 支付结果页路径（与网关 return_url 保持一致） */
export function paymentResultPath(orderNo: string) {
  return `/payment/return?orderNo=${encodeURIComponent(orderNo)}`;
}

/**
 * 跳转第三方收银台。
 *
 * 两个关键点（都是为了微信/支付宝内置浏览器）：
 * 1. 先把支付结果页压入 history。微信内完成支付后往往不会执行网关的 return_url，
 *    而是直接关闭/回退 webview；提前压栈后，回退落到的是我们的结果页。
 * 2. 必须同窗跳转。window.open('_blank') 在微信内会新开一个 webview 栈，
 *    支付完成后微信关闭该 webview，用户会直接被弹回聊天界面。
 */
export function redirectToPayment(paymentUrl: string, orderNo: string) {
  window.history.pushState({}, '', paymentResultPath(orderNo));
  window.location.assign(paymentUrl);
}
