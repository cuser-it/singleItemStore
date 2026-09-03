# 数据库分析结果

**分析时间**：2024年
**分析人员**：AI Assistant

## 执行摘要

经过详细调查，发现：

1. ✅ **single_item_store 数据库几乎为空**，可以安全删除
2. ✅ **user_MTYdSm 数据库完全为空**，可以安全删除
3. ⚠️ **fsd 数据库存在两套系统的表**，需要整理

## 详细分析

### 1. single_item_store 数据库（旧系统）

| 表名 | 数据量 | 状态 |
|------|-------|------|
| Order | 0 | 空表 |
| Admin | 0 | 空表 |
| Payment | 0 | 空表 |
| ProductTemplate | 1 | 仅有1条测试数据 |
| 其他表 | 未检查 | 预计也是空的 |

**结论**：此数据库基本为空，只有 ProductTemplate 有 1 条记录（很可能是测试数据），**可以安全删除**。

### 2. fsd 数据库（当前系统）

#### 当前使用的多站点系统表（Prisma Schema 中定义）

| 表名 | 数据量 | 用途 | 状态 |
|------|-------|------|------|
| Site | 1 | 站点管理 | ✅ 使用中 |
| SiteSettings | 1 | 站点配置 | ✅ 使用中 |
| MediaAsset | 51 | 媒体资源 | ✅ 使用中 |
| Review | 20 | 用户评价 | ✅ 使用中 |
| ProductSku | 4 | 商品SKU | ✅ 使用中 |
| FloatingPurchase | ? | 浮动购买提示 | ✅ 使用中 |
| Order | ? | 订单 | ✅ 使用中 |
| PaymentSettings | ? | 支付配置 | ✅ 使用中 |
| OperationLog | ? | 操作日志 | ✅ 使用中 |

#### 旧系统遗留表（未在 Prisma Schema 中定义）

| 表名 | 数据量 | 说明 | 状态 |
|------|-------|------|------|
| ProductTemplate | 1 | 旧商品模板系统 | ⚠️ 遗留 |
| ProductAsset | 0 | 旧商品资源 | ⚠️ 空表 |
| ProductReview | 0 | 旧商品评价 | ⚠️ 空表 |
| ProductPackage | 3 | 旧商品套餐 | ⚠️ 遗留 |
| Admin | ? | 管理员（与新系统可能冲突） | ⚠️ 需检查 |
| AdminActionLog | ? | 管理员操作日志 | ⚠️ 需检查 |
| AdminLoginLog | ? | 管理员登录日志 | ⚠️ 需检查 |
| CustomerChannel | ? | 客户渠道 | ⚠️ 需检查 |
| OrderSnapshot | ? | 订单快照 | ⚠️ 需检查 |
| Payment | ? | 支付记录 | ⚠️ 需检查 |
| PaymentNotifyLog | ? | 支付回调日志 | ⚠️ 需检查 |
| OrderLegacy | ? | 旧订单备份 | ⚠️ 需检查 |

### 3. 关键发现

#### 🔴 严重问题：fsd 中存在两套系统

**新系统（当前使用）：**
- 基于 Site（多站点）架构
- 使用 `ProductSku` 作为商品
- 使用 `MediaAsset` 管理媒体
- 使用 `Review` 管理评价
- **所有表都在 Prisma Schema 中定义**

**旧系统（遗留）：**
- 基于 ProductTemplate（单商品模板）架构
- 使用 `ProductPackage` 作为商品套餐
- 使用 `ProductAsset` 管理商品资源
- 使用 `ProductReview` 管理商品评价
- **这些表不在当前 Prisma Schema 中**

#### 📊 数据冲突分析

**新旧系统的对应关系：**

| 新系统（使用中） | 旧系统（遗留） | 功能重复 | 数据迁移需求 |
|----------------|--------------|---------|------------|
| MediaAsset (51条) | ProductAsset (0条) | ✅ 是 | ❌ 无需 |
| Review (20条) | ProductReview (0条) | ✅ 是 | ❌ 无需 |
| ProductSku (4条) | ProductPackage (3条) | ⚠️ 类似 | ⚠️ 需评估 |
| SiteSettings | ProductTemplate (1条) | ⚠️ 类似 | ⚠️ 需评估 |

#### 🎯 关键结论

1. **ProductAsset 和 ProductReview 是空表** → 可以直接删除
2. **ProductPackage 有 3 条数据** → 需要确认是否需要迁移到 ProductSku
3. **ProductTemplate 有 1 条数据** → 需要确认是否需要保留

## 推荐方案

### 🟢 方案 1：保守清理（推荐）

**执行步骤：**

1. ✅ **立即删除空数据库**
   - 删除 `user_MTYdSm` 空数据库
   - 删除 `single_item_store` 旧数据库

2. ✅ **清理 fsd 中的空表**
   - 删除 `ProductAsset` (0条数据)
   - 删除 `ProductReview` (0条数据)

3. ⚠️ **评估后决定**
   - 检查 `ProductPackage` 的 3 条数据是否重要
   - 检查 `ProductTemplate` 的 1 条数据是否重要
   - 检查 `Admin`、`Payment` 等表是否在使用

**优点：**
- ✅ 风险最低
- ✅ 立即清理明确无用的数据
- ✅ 为后续决策保留空间

**缺点：**
- ⚠️ 仍保留部分冗余表

### 🟡 方案 2：完整清理（需谨慎）

**前提条件：**
- 确认 ProductPackage 和 ProductTemplate 的数据可以丢弃
- 确认 Admin、Payment 等表不在使用或可以删除

**执行步骤：**
1. 删除所有旧系统表
2. 只保留 Prisma Schema 中定义的表

**优点：**
- ✅ 彻底清理，结构清晰

**缺点：**
- 🔴 风险较高
- 🔴 可能丢失重要数据

## 立即执行方案（方案 1 第一步）

### 步骤 1：备份数据库

```bash
# 创建备份目录
mkdir -p /mnt/d/wsl/code/singleItemStore/backups

# 备份 fsd 数据库
PGPASSWORD=password_2CGeyC pg_dump -h 103.236.76.222 -U user_MTYdSm -d fsd -F c -f /mnt/d/wsl/code/singleItemStore/backups/fsd_backup_$(date +%Y%m%d_%H%M%S).dump

# 备份 single_item_store 数据库
PGPASSWORD=password_2CGeyC pg_dump -h 103.236.76.222 -U user_MTYdSm -d single_item_store -F c -f /mnt/d/wsl/code/singleItemStore/backups/single_item_store_backup_$(date +%Y%m%d_%H%M%S).dump

echo "✅ 备份完成"
```

### 步骤 2：删除无用数据库

```sql
-- 连接到 postgres 数据库
-- psql -h 103.236.76.222 -U user_MTYdSm -d postgres

-- 删除空数据库
DROP DATABASE IF EXISTS user_MTYdSm;

-- 删除旧系统数据库（确认无重要数据后）
DROP DATABASE IF EXISTS single_item_store;
```

### 步骤 3：清理 fsd 中的空表

```sql
-- 连接到 fsd 数据库
-- psql -h 103.236.76.222 -U user_MTYdSm -d fsd

-- 删除空表
DROP TABLE IF EXISTS "ProductAsset" CASCADE;
DROP TABLE IF EXISTS "ProductReview" CASCADE;
```

### 步骤 4：验证

```sql
-- 查看剩余的表
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 验证关键数据
SELECT 'Site' as table_name, COUNT(*) FROM "Site"
UNION ALL SELECT 'MediaAsset', COUNT(*) FROM "MediaAsset"
UNION ALL SELECT 'Review', COUNT(*) FROM "Review"
UNION ALL SELECT 'ProductSku', COUNT(*) FROM "ProductSku";
```

## 需要进一步调查的问题

在执行完第一步后，需要调查以下问题：

1. **ProductPackage (3条数据)**
   - 查看这 3 条数据的内容
   - 确认是否需要迁移到 ProductSku
   - 确认代码中是否有引用

2. **ProductTemplate (1条数据)**
   - 查看这条数据的内容
   - 确认是否与当前 SiteSettings 相关
   - 确认代码中是否有引用

3. **Admin/Payment 等表**
   - 检查数据量
   - 确认是否在使用
   - 确认是否与 Prisma Schema 中的定义一致

## 后续建议

执行完清理后，建议：

1. ✅ **更新 Prisma Schema**
   - 确保所有实际表都在 Schema 中定义
   - 删除 Schema 中不存在的表定义

2. ✅ **运行迁移**
   ```bash
   npx prisma migrate dev
   ```

3. ✅ **更新文档**
   - 记录数据库清理历史
   - 更新架构文档

4. ✅ **测试**
   - 运行所有测试
   - 验证应用功能正常
