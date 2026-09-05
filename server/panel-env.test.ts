import { describe, expect, it } from 'vitest';
// 面板启动脚本的环境探测逻辑：曾因为没加载 .env 而误判"未配置数据库"，跳过了 prisma 迁移
import { checkDatabaseHost, maskDatabaseUrl } from '../scripts/panel-env.mjs';

describe('面板启动：数据库连接串探测', () => {
  it('打印日志时遮蔽密码', () => {
    expect(maskDatabaseUrl('postgresql://fsd_user:sup3rSecret@db-host:5432/fsd')).toBe(
      'postgresql://fsd_user:****@db-host:5432/fsd',
    );
  });

  it('没有连接串时返回 missing', () => {
    expect(checkDatabaseHost(undefined)).toEqual({ ok: false, reason: 'missing' });
  });

  it('容器内使用 localhost / 127.0.0.1 判定为不可达', () => {
    for (const host of ['localhost', '127.0.0.1']) {
      const result = checkDatabaseHost(`postgresql://u:p@${host}:5432/fsd`, { inContainer: true });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('loopback-in-container');
      expect(result.host).toBe(host);
    }
  });

  it('容器内指向数据库容器名时通过', () => {
    const result = checkDatabaseHost('postgresql://u:p@1Panel-postgresql-abcd:5432/fsd', { inContainer: true });
    expect(result).toEqual({ ok: true, host: '1Panel-postgresql-abcd' });
  });

  it('非容器环境下 localhost 是合法的（本地开发）', () => {
    expect(checkDatabaseHost('postgresql://u:p@127.0.0.1:5432/fsd').ok).toBe(true);
  });

  it('连接串格式非法时返回 invalid', () => {
    expect(checkDatabaseHost('not-a-url')).toEqual({ ok: false, reason: 'invalid' });
  });
});
