# 生产部署指南（单端口 + nginx + HTTPS）

## 架构

```
浏览器 ──HTTPS(443)──> nginx ──HTTP(127.0.0.1:3001)──> Node 进程
                                                        ├── /api/*   接口
                                                        ├── /img/*   本地上传（未配 S3 时）
                                                        └── /*       前端 dist（SPA 回退）
```

Node 进程**同时托管前端产物与 API**，只需要一个端口。nginx 只做 TLS 终止和反向代理。

## 一、端口怎么填

| 变量 | 说明 | 生产取值 |
|---|---|---|
| `PORT` | `server/index.ts` 监听端口，监听 `0.0.0.0` | `3001`（任意 >1024 空闲端口即可） |
| `BACKEND_PORT` / `VITE_BACKEND_PORT` | 仅 `npm start`（开发模式，vite dev）使用 | **生产不要设置** |

> ⚠️ `npm start` 走的是 `scripts/start.mjs`，会启动 vite 开发服务器，并且端口被占用时会自动"顺延找空闲端口"，生产环境务必改用 `npm run start:prod`（固定读 `PORT`）。

建议把 Node 只绑内网：如果服务器有公网 IP，用防火墙/安全组只放行 80/443，不要放行 3001。

## 二、环境变量（服务器上的 `.env`）

```bash
PORT=3001
NODE_ENV=production

# 数据库：必须指向 fsd 库
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/fsd

# 后台登录：务必改掉默认值
ADMIN_PASSWORD=<强密码>   # 代码只校验密码，默认值 admin123456 必须改掉

MAX_UPLOAD_SIZE_MB=20

# 对象存储（强烈建议配置，否则上传落在本地 storage/img，重部署会丢）
S3_ENDPOINT=https://...
S3_REGION=auto
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://cdn.example.com/...
S3_FORCE_PATH_STYLE=true

# 易支付：回调地址必须是公网 HTTPS 域名，不能是 localhost / 内网 IP
EPAY_GATEWAY_URL=https://pay.example.com/submit.php
EPAY_MERCHANT_ID=...
EPAY_MERCHANT_SECRET=...
EPAY_NOTIFY_URL=https://shop.example.com/api/payment/epay/notify
EPAY_RETURN_URL=https://shop.example.com/payment/return
```

另外，后台「支付设置」里的**公网访问地址（publicBaseUrl）**也要填 `https://shop.example.com`，支付跳转链接依赖它。

## 三、部署步骤

```bash
cd /opt/singleItemStore
git pull origin master

# 安装依赖 + 生成 Prisma Client + 迁移 + 构建前端（一条命令）
npm run deploy

# 启动（前台验证）
npm run start:prod
# 看到 backend listening on http://localhost:3001 后，另开终端：
curl -i http://127.0.0.1:3001/healthz   # {"ok":true}
curl -I http://127.0.0.1:3001/          # 200 text/html
```

确认无误后交给进程管理器托管（见第五节）。

## 四、nginx 配置

```nginx
server {
    listen 80;
    server_name shop.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name shop.example.com;

    ssl_certificate     /etc/letsencrypt/live/shop.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.example.com/privkey.pem;

    # 上传图片会走这里，要放开限制（与 MAX_UPLOAD_SIZE_MB 对齐并留余量）
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 订单实时推送用了 SSE，必须关闭缓冲，否则后台订单列表不会实时刷新
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

关键点：
- `proxy_buffering off;` — 后台订单实时推送走 SSE（`/api/admin/orders/events`），开着缓冲会导致消息卡住。
- `client_max_body_size` — 默认 1MB，不改会让图片上传 413。
- `X-Forwarded-Proto` — 让后端生成的回调/跳转地址是 https。

## 五、进程守护（systemd）

`/etc/systemd/system/single-item-store.service`：

```ini
[Unit]
Description=Single Item Store
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/singleItemStore
EnvironmentFile=/opt/singleItemStore/.env
ExecStart=/usr/bin/npm run start:prod
Restart=always
RestartSec=5
StandardOutput=append:/var/log/single-item-store.log
StandardError=append:/var/log/single-item-store.log

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now single-item-store
systemctl status single-item-store
journalctl -u single-item-store -f
```

日志记得配 logrotate，否则会无限增长（仓库根目录那个 `server.log` 是开发遗留，不要用它）。

用 pm2 的话：`pm2 start npm --name single-item-store -- run start:prod && pm2 save && pm2 startup`。

## 六、上线后自检

- [ ] `https://shop.example.com/` 首页正常渲染，刷新子路由（如后台页面）不 404
- [ ] `https://shop.example.com/healthz` 返回 `{"ok":true}`
- [ ] 后台能登录，且默认密码已改
- [ ] 上传一张图片成功，图片 URL 可公网访问
- [ ] 下一单走通支付，`notify` 回调能落到订单上（查支付状态变 `PAID`）
- [ ] 导出订单，字段显示为中文（支付状态/履约状态/时间）
- [ ] `netstat -tlnp | grep 3001` 确认端口正确，且防火墙未对外暴露 3001

## 七、常见问题

| 症状 | 原因 |
|---|---|
| 访问根路径 404 | 没执行 `npm run build`，`dist/` 不存在时后端会跳过静态托管 |
| 刷新子路由 404 | nginx 直接 serve 了 dist 而没配 `try_files`；本方案交给 Node 处理即可 |
| 后台订单不实时刷新 | nginx 没关 `proxy_buffering` |
| 图片上传 413 | `client_max_body_size` 太小 |
| 支付回调不到账 | `EPAY_NOTIFY_URL` / publicBaseUrl 填的不是公网 HTTPS 地址 |
| Prisma 报字段不存在 | 忘了 `npx prisma migrate deploy` + `npx prisma generate` |
