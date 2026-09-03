# Bug 修复方案

## 问题 1：更新商品规格价格后，前端显示还是 99 元

### 根本原因
经过数据库检查，SKU 数据**已经正确更新**。问题可能出在：
1. 前端显示的是 `salePrice` 字段（99.0），而不是 `productVariants[0].price`（66）
2. 前端缓存问题

### 解决方案
1. 统一价格字段：确保 `salePrice` 和 `productVariants[0].price` 保持同步
2. 更新站点设置后，强制刷新前端数据

## 问题 2：复制默认站点时，使用初始化数据而不是当前数据

### 根本原因
数据库中存在孤立的 SiteSettings 数据（站点被删除但关联数据未删除），导致：
1. `nextSettingsId()` 可能返回已存在的 ID
2. 插入新 SiteSettings 时可能因主键冲突而失败或使用旧数据

### 解决方案
1. **立即修复**：清理数据库中的孤立数据
2. **防止复发**：改进 `deleteSite` 函数，确保级联删除
3. **改进 `duplicateSiteContent`**：添加错误处理和日志

## 实施步骤

### 步骤 1：清理孤立数据
```sql
-- 删除没有对应站点的 SiteSettings
DELETE FROM "SiteSettings" WHERE "siteId" NOT IN (SELECT id FROM "Site");

-- 删除没有对应站点的其他关联数据
DELETE FROM "MediaAsset" WHERE "siteId" NOT IN (SELECT id FROM "Site");
DELETE FROM "Review" WHERE "siteId" NOT IN (SELECT id FROM "Site");
DELETE FROM "FloatingPurchase" WHERE "siteId" NOT IN (SELECT id FROM "Site");
DELETE FROM "ProductSku" WHERE "siteId" NOT IN (SELECT id FROM "Site");
DELETE FROM "PaymentSettings" WHERE "siteId" NOT IN (SELECT id FROM "Site");
DELETE FROM "OperationLog" WHERE "siteId" NOT IN (SELECT id FROM "Site");
```

### 步骤 2：修复 `deleteSite` 函数
虽然 Prisma schema 已配置级联删除，但需要确保数据库约束已正确应用。

### 步骤 3：改进 `duplicateSiteContent` 函数
添加日志和错误处理，确保复制操作透明可追踪。

### 步骤 4：统一价格字段
确保更新 `productVariants` 时，同步更新 `salePrice`。
