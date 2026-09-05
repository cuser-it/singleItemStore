# 1Panel 部署指南

> 面向使用 1Panel 面板的部署场景。核心问题先回答：
>
> **要上传整个项目，不是只上传后端。** 因为后端进程负责托管前端构建产物 `dist/`，而 `dist/` 需要由项目里的 `src/` 构建产生；同时 `server/` 与 `src/` 共用 `shared/` 里的类型定义，`prisma/` 目录还存着数据库迁移。三者缺一不可。
>
> 这个项目**不是静态网站**，不能用 1Panel 的「静态网站」类型，必须用「运行环境（Node.js）」。

---

## 第 0 步：准备数据库

1Panel → **应用商店** → 安装 **PostgreSQL**。安装后在 **数据库 → PostgreSQL** 里创建数据库，名字填 `fsd`（本项目强制要求），记下用户名和密码。

⚠️ 关键点：1Panel 的应用和运行环境都跑在 Docker 里。连接串里的主机名**不能写 `127.0.0.1`**（那是容器自己），要写 **PostgreSQL 的容器名**，在 应用商店 → 已安装 → PostgreSQL → 参数 里能看到，通常形如 `1Panel-postgresql-xxxx`。

```
DATABASE_URL=postgresql://用户名:密码@1Panel-postgresql-xxxx:5432/fsd
```

---

## 第 1 步：把代码放到服务器

**推荐用 git（后续更新一条命令）**，1Panel → 终端 / SSH：

```bash
mkdir -p /opt/apps && cd /opt/apps
git clone git@github.com:cuser-it/singleItemStore.git
cd singleItemStore
```

如果用 1Panel 文件管理上传压缩包也可以，但**上传前请删掉这三样**（体积大且必须在服务器重新生成）：

- `node_modules/`
- `dist/`
- `.env`（本地的数据库地址、密钥不能带上服务器）

其余目录 `src/ server/ shared/ prisma/ scripts/ public/ package.json package-lock.json index.html vite.config.ts tsconfig.json` **全部都要**。

---

## 第 2 步：创建 `.env`

在项目根目录新建 `.env`（1Panel 文件管理里可直接编辑）：

```bash
PORT=3001
NODE_ENV=production

DATABASE_URL=postgresql://用户名:密码@1Panel-postgresql-xxxx:5432/fsd

ADMIN_PASSWORD=改成你的强密码

MAX_UPLOAD_SIZE_MB=20

# 易支付（域名换成你自己的）
EPAY_GATEWAY_URL=https://pay.example.com/submit.php
EPAY_MERCHANT_ID=你的商户号
EPAY_MERCHANT_SECRET=你的密钥
EPAY_NOTIFY_URL=https://shop.example.com/api/payment/epay/notify
EPAY_RETURN_URL=https://shop.example.com/payment/return

# 对象存储（可选但强烈建议，不配则图片存容器内，重建容器会丢）
# S3_ENDPOINT=...
# S3_BUCKET=...
# S3_ACCESS_KEY_ID=...
# S3_SECRET_ACCESS_KEY=...
# S3_PUBLIC_BASE_URL=...
```

---

## 第 3 步：先手动构建一次（重要）

前端构建大约需要 1~2 分钟，如果直接交给面板启动，面板可能因为迟迟没监听端口而判定启动失败。所以**先在 SSH 里手动跑一次**：

```bash
cd /opt/apps/singleItemStore
npm install
npm run build
```

> 若服务器内存小于 1G，构建可能被 OOM 杀掉，可临时加 swap 或在本地构建好后把 `dist/` 传上去。

---

## 第 4 步：创建 Node.js 运行环境

1Panel → **网站 → 运行环境 → Node.js → 创建**：

| 字段 | 填写 |
|---|---|
| 名称 | `single-item-store` |
| 源码目录 | `/opt/apps/singleItemStore` |
| Node 版本 | 20 或 22（项目开发用 24，20+ 均可） |
| 包管理器 | npm |
| 安装依赖 | 开启（等价 `npm install`） |
| 启动命令 | 选 **`start:panel`** |
| 端口 | `3001`（要和 `.env` 里的 `PORT` 一致） |
| 外部映射端口 | 随意，如 `3001`；只要不和别的服务撞 |

**启动命令必须选 `start:panel`**，它会依次做：`prisma generate` → `prisma migrate deploy` → 缺 `dist` 时构建前端 → 启动后端。已经就绪的步骤自动跳过，重启很快。

> 想强制重新构建前端时，在环境变量里加 `PANEL_FORCE_BUILD=1` 再重启即可。

保存后启动，看运行环境的日志，出现 `backend listening on http://localhost:3001` 就成功了。

---

## 第 5 步：创建网站并绑定域名 + HTTPS

1Panel → **网站 → 创建网站 → 运行环境**：

- 主域名：`shop.example.com`
- 运行环境：选上一步创建的 `single-item-store`

创建后进入网站 → **HTTPS**，用 Let's Encrypt 申请证书并开启「强制 HTTPS」。

### 必须改的两处反代配置

网站 → **配置文件**（或 反向代理 → 编辑），在 `location /` 里补上：

```nginx
client_max_body_size 25m;      # 不改会导致后台上传图片 413

proxy_buffering off;           # 后台订单实时推送走 SSE，开着缓冲会卡住不刷新
proxy_read_timeout 1h;

proxy_set_header X-Forwarded-Proto $scheme;
```

保存并重载。

---

## 第 6 步：验收

浏览器依次访问：

- `https://shop.example.com/` → 商品页正常
- `https://shop.example.com/healthz` → `{"ok":true}`
- `https://shop.example.com/admin` → 后台登录页，用 `.env` 里的密码登录
- 后台上传一张图片 → 成功且能打开
- 后台「支付设置」里把**公网访问地址**填成 `https://shop.example.com`
- 下一笔测试单，确认支付回调能把订单状态刷成已支付
- 后台导出订单 → 字段是中文

---

## 后续更新代码

```bash
cd /opt/apps/singleItemStore
git pull
npm install
npm run build          # 前端有改动时才需要
```

然后在 1Panel 里点运行环境的「重启」。（`start:panel` 会自动补跑数据库迁移。）

---

## 常见问题

| 现象 | 原因与处理 |
|---|---|
| 运行环境启动失败，日志报 `Can't reach database server` | `DATABASE_URL` 写成了 `127.0.0.1`，要改成 PostgreSQL 的**容器名** |
| 启动很久没反应然后失败 | 首次在容器里构建前端超时 → 先按第 3 步在 SSH 手动 `npm run build` |
| 网站打开 404 / 白屏 | `dist/` 没构建出来，后端会跳过静态托管；执行 `npm run build` 后重启 |
| 后台上传图片报 413 | 反代没加 `client_max_body_size 25m;` |
| 后台订单不实时刷新 | 反代没加 `proxy_buffering off;` |
| 支付回调不到账 | `EPAY_NOTIFY_URL` 和后台「公网访问地址」必须是 `https://你的域名`，不能是 IP 或 localhost |
| 重建容器后图片全没了 | 未配置 S3，图片存在容器内的 `storage/img`；请配置对象存储 |
| Prisma 报字段不存在 | 迁移没跑成功，SSH 进目录执行 `npx prisma migrate deploy && npx prisma generate` |

---

## 不用面板的话

如果你更习惯 systemd / pm2 + 手写 nginx，见 [`deployment.md`](deployment.md)。
