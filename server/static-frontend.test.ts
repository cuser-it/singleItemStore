import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from './app';
import { createMemoryStore } from './store';

const uploadDir = mkdtempSync(path.join(os.tmpdir(), 'static-upload-'));
const staticDir = mkdtempSync(path.join(os.tmpdir(), 'static-dist-'));
let server: Server;
let baseUrl = '';

beforeAll(async () => {
  mkdirSync(path.join(staticDir, 'assets'), { recursive: true });
  writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>spa</title>');
  writeFileSync(path.join(staticDir, 'assets', 'index-abc123.js'), 'console.log("bundle");');

  const app = await createApp({ store: createMemoryStore(), uploadDir, staticDir, adminPassword: 'admin123456' });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('bind failed');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(uploadDir, { recursive: true, force: true });
  rmSync(staticDir, { recursive: true, force: true });
});

describe('生产单端口：后端同时托管前端产物', () => {
  it('根路径返回 SPA 入口 index.html', async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>spa</title>');
  });

  it('前端路由（如 /admin）回退到 index.html 而不是 404', async () => {
    const response = await fetch(`${baseUrl}/admin/orders`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>spa</title>');
  });

  it('带 hash 的静态资源按原文件返回并带长缓存头', async () => {
    const response = await fetch(`${baseUrl}/assets/index-abc123.js`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('bundle');
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  it('SPA 回退不会吞掉 API 与健康检查路由', async () => {
    const health = await fetch(`${baseUrl}/healthz`);
    expect(await health.json()).toEqual({ ok: true });

    // 未登录的后台接口必须仍返回 401，而不是被回退成 index.html
    const admin = await fetch(`${baseUrl}/api/admin/orders`);
    expect(admin.status).toBe(401);

    // 不存在的 API 路径应保持 404 JSON 语义，不能返回 HTML
    const missing = await fetch(`${baseUrl}/api/not-exist`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('content-type') ?? '').not.toContain('text/html');
  });
});
