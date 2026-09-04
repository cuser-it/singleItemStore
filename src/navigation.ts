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
