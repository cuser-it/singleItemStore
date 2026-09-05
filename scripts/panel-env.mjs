/**
 * 面板启动脚本用到的环境探测工具。
 * 独立成模块是为了能被单元测试覆盖（scripts 目录本身不参与 vitest 收集）。
 */

/** 把连接串里的密码遮掉，方便打印到日志排查 */
export function maskDatabaseUrl(url) {
  if (!url) return '';
  return url.replace(/^(\w+:\/\/[^:/@]+):[^@]*@/, '$1:****@');
}

/**
 * 判断连接串指向的主机在容器里是否可达。
 * 1Panel / Docker 部署时，从本地 .env 复制过来的 localhost 指的是容器自己，必然连不上数据库。
 */
export function checkDatabaseHost(url, { inContainer = false } = {}) {
  if (!url) return { ok: false, reason: 'missing' };
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (inContainer && isLoopback) return { ok: false, reason: 'loopback-in-container', host };
  return { ok: true, host };
}
