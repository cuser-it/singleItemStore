# Single Item Store · 单品落地页商城

面向**单品/少 SKU** 场景的落地页式商城：一个高转化的移动端商品长页 + 一套可视化后台，支持多站点、易支付收银、订单履约与导出。

---

## 功能概览

### 前台（`/`）
- 商品长页：轮播头图、规格（SKU）选择、详情图集、买家评价、悬浮成交提示
- 底部常驻下单栏 + 下单抽屉，填写收货信息后直接跳转支付
- 支付成功页（`/payment/return`）：展示订单号、引导添加客服（二维码 / 链接）、返回拦截
- 订单查询：订单号 + 手机号自助查询物流与状态

### 后台（`/admin`）
- **站点管理**：多站点配置，按 slug 区分，可切换激活站点
- **内容管理**：头图 / 详情图 / 评价 / 悬浮成交提示，均支持上传与排序
- **SKU 管理**：价格、划线价、副标题、上下架、排序
- **订单管理**：列表筛选（支付状态 / 履约状态 / 退款状态 / 时间范围）、发货、退款标记、软删除
- **实时推送**：新订单通过 SSE 实时进入列表
- **订单导出**：自定义列导出 xlsx，枚举与时间字段已中文化、时间统一为上海时区
- **支付设置**：易支付网关、商户号、密钥、回调地址、公网访问地址

---

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 7（自研轻量路由，无 router 依赖） |
| 后台 UI | antd 6 |
| 后端 | Express 5 + TypeScript（tsx 运行，无编译步骤） |
| 数据库 | PostgreSQL + Prisma 6 |
| 存储 | S3 兼容对象存储（RustFS / MinIO / OSS），未配置时回落本地 `storage/img` |
| 支付 | 易支付（EPay）MD5 签名 |
| 测试 | Vitest（client: jsdom / server: node 双 project） |

---

## 目录结构

```
├── src/                  前端
│   ├── App.tsx           前台落地页 + 路由分发
│   ├── AdminApp.tsx      后台主应用
│   ├── PaymentSuccess.tsx 支付成功页
│   ├── api.ts            前后端接口封装
│   └── components/       页面区块组件
├── server/               后端
│   ├── index.ts          进程入口（读 PORT）
│   ├── app.ts            Express 应用：所有路由 + 静态托管
│   ├── orders.ts         订单 / SKU / 支付 / 导出 领域服务
│   ├── store.ts          内容存储接口 + 内存实现（测试用）
│   ├── prismaStore.ts    Prisma 实现（生产）
│   └── uploadStorage.ts  本地 / S3 上传适配
├── shared/               前后端共享类型（order.ts / site.ts）
├── prisma/schema.prisma  数据模型与迁移
├── scripts/              启动脚本与一次性运维脚本
└── docs/                 部署、支付配置、数据库重构等文档
```

---

## 快速开始

```bash
npm install

# 配置环境变量
cp .env.example .env
#   DATABASE_URL 指向 fsd 库；不配则自动使用内存存储（数据不落盘）

npx prisma generate
npx prisma migrate dev     # 首次初始化数据库

npm start
# backend  http://localhost:3001
# frontend http://localhost:5173   ← 开发时访问这个
```

`npm start` 会同时拉起后端与 vite dev server，并自动把 `/api`、`/img` 代理到后端；端口被占用时会自动顺延。

后台入口：`http://localhost:5173/admin`，默认密码见 `.env` 的 `ADMIN_PASSWORD`。

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm start` | 开发模式：后端 + vite dev（**仅开发用**） |
| `npm run dev` | 只起 vite dev |
| `npm run server` | 只起后端 |
| `npm run build` | 构建前端到 `dist/` |
| `npm run start:prod` | 生产启动：单进程同时提供 API 与 `dist/`，端口取 `PORT` |
| `npm run deploy` | 装依赖 + prisma generate + migrate deploy + build |
| `npm test` | 全量测试（Vitest） |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | typecheck + test，**提交前跑这个** |

---

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `PORT` | | 后端监听端口，默认 `3001` |
| `DATABASE_URL` | 生产必填 | PostgreSQL 连接串，**必须指向 `fsd` 库**；留空则用内存存储 |
| `ADMIN_PASSWORD` | ✅ | 后台密码，默认 `admin123456` 必须改 |
| `MAX_UPLOAD_SIZE_MB` | | 上传大小上限，默认 20 |
| `STATIC_DIR` | | 前端产物目录，默认 `dist`；目录不存在则不挂载静态服务 |
| `S3_*` | | 对象存储配置，见 `.env.example`；不配则存本地 `storage/img` |
| `EPAY_*` | 生产必填 | 易支付网关、商户号、密钥、notify / return 地址 |

---

## 主要接口

```
GET    /healthz                          健康检查
GET    /api/public/bootstrap             前台一次性拉取全部展示数据（带缓存）
POST   /api/public/orders                创建订单（支持幂等键）
GET    /api/public/orders/:orderNo       订单自助查询
GET|POST /api/payment/epay/notify        易支付回调
POST   /api/admin/login                  后台登录（Cookie 会话）
GET    /api/admin/orders                 订单列表（多维筛选、分页）
GET    /api/admin/orders/events          订单实时推送（SSE）
GET    /api/admin/orders/export          导出 xlsx（自定义列）
POST   /api/admin/orders/:id/ship        发货
POST   /api/admin/upload                 图片上传
```

完整清单见 `server/app.ts`。

---

## 部署

生产采用 **Node 单端口 + nginx 反代 + HTTPS**：Node 进程同时托管 API 与前端 `dist/`，nginx 只做 TLS 终止。

```bash
npm run deploy
npm run start:prod        # 建议交给 systemd / pm2 托管
```

完整步骤、nginx 配置、systemd unit、上线自检清单见 **[`docs/deployment.md`](docs/deployment.md)**。

其他文档：
- [`docs/payment-configuration.md`](docs/payment-configuration.md) — 支付配置
- [`docs/易支付配置说明.md`](docs/易支付配置说明.md) — 易支付对接细节
- [`docs/database-refactoring-plan.md`](docs/database-refactoring-plan.md) — 数据库重构记录

---

## 开发约定

1. **单一数据库原则**：所有 CRUD 只操作 `fsd` 库，统一使用同一个 PrismaClient 实例。
2. **SKU 数据主存储为 `ProductSku` 表**；`SiteSettings.productVariants` 仅用于站点初始化，更新 SKU 时不得触发覆盖逻辑。
3. **每次改动都要有对应 git commit**，便于追踪与回滚。
4. **每次改动都要补充或更新测试**，交付前 `npm run verify` 必须全绿。
5. **修 Bug 先定位根因**，不做表面症状修补。

---

## 测试说明

Vitest 分两个 project：

- `client` — `src/**/*.test.tsx`，jsdom 环境
- `server` — `server/**/*.test.ts`，node 环境，并强制清空 `DATABASE_URL` 与 `S3_*`，防止测试误写生产库和真实存储桶

```bash
npx vitest run --project server           # 只跑后端
npx vitest run server/order-export.test.ts # 跑单个文件
```
