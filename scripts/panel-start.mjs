import 'dotenv/config';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { checkDatabaseHost, maskDatabaseUrl } from './panel-env.mjs';

/**
 * 面板（1Panel 等）用的一键启动脚本。
 *
 * 面板类运行环境通常只允许填「安装命令 + 启动命令」，没有地方跑构建和数据库迁移，
 * 因此这里在启动前按需补齐：prisma generate → migrate deploy → 构建前端 → 启动后端。
 * 已经就绪的步骤会自动跳过，重启容器不会白等一次前端构建。
 *
 * 注意：必须先 import 'dotenv/config'，否则读不到项目根目录 .env 里的 DATABASE_URL，
 * 会误判成「未配置数据库」而跳过迁移（后端自身有 dotenv，因此表现为"能启动但没迁移"）。
 */

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`[panel] ${label}: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} 失败，退出码 ${code}`))));
  });
}

const databaseUrl = process.env.DATABASE_URL;
const inContainer = existsSync('/.dockerenv');
const distIndex = path.resolve(process.cwd(), 'dist', 'index.html');
const forceBuild = process.env.PANEL_FORCE_BUILD === '1';

if (databaseUrl) {
  console.log(`[panel] DATABASE_URL = ${maskDatabaseUrl(databaseUrl)}`);
  const check = checkDatabaseHost(databaseUrl, { inContainer });
  if (check.reason === 'loopback-in-container') {
    console.error(`[panel] DATABASE_URL 指向 ${check.host}，但当前运行在容器内，这指的是容器自己，连不到数据库。`);
    console.error('[panel] 请把主机名改成数据库的容器名（如 1Panel-postgresql-xxxx）或宿主机内网 IP。');
    process.exit(1);
  }
  await run('npx', ['prisma', 'generate'], '生成 Prisma Client');
  await run('npx', ['prisma', 'migrate', 'deploy'], '执行数据库迁移');
} else {
  // 没有 DATABASE_URL 时后端会退回内存存储，数据不落盘，仅适合临时验证
  console.warn('[panel] 未设置 DATABASE_URL：请确认项目根目录存在 .env 且其中配置了 DATABASE_URL。');
  console.warn('[panel] 当前将使用内存存储，重启后数据会丢失。');
}

if (forceBuild || !existsSync(distIndex)) {
  await run('npm', ['run', 'build'], '构建前端');
} else {
  console.log('[panel] 已存在 dist/index.html，跳过前端构建（需重建请设置 PANEL_FORCE_BUILD=1）');
}

console.log(`[panel] 启动后端，端口 ${process.env.PORT ?? 3001}`);
await run('npx', ['tsx', 'server/index.ts'], '启动后端');
