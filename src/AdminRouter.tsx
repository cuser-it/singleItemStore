import { useEffect, useState } from 'react';

/**
 * 简单的路由管理器
 * 使用 URL hash (#/path) 来管理路由，支持浏览器前进后退
 */
export function useAdminRouter() {
  const getPath = () => {
    const hash = window.location.hash.slice(1); // 移除开头的 #
    return hash || '/dashboard'; // 默认路由
  };

  const [currentPath, setCurrentPath] = useState(getPath());

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(getPath());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  return { currentPath, navigate };
}

/**
 * 从 hash 路径中提取页面 key
 * 例如: /dashboard -> dashboard
 *      /orders -> orders
 *      /settings/site -> settings
 */
export function getPageKey(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[0] || 'dashboard';
}

/**
 * 路由配置
 */
export const ADMIN_ROUTES = {
  DASHBOARD: '/dashboard',
  ORDERS: '/orders',
  SKUS: '/skus',
  PAYMENT: '/payment',
  SETTINGS: '/settings',
  MEDIA: '/media',
  REVIEWS: '/reviews',
  PURCHASES: '/purchases',
} as const;
