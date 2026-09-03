# 数据库重构方案

## 执行日期
2024年（待定）

## 当前状态

### 数据库列表
| 数据库名 | 表数量 | 状态 | 说明 |
|---------|-------|------|------|
| fsd | 21 | ✅ 使用中 | 当前多站点系统主数据库 |
| single_item_store | 12 | ⚠️ 废弃 | 旧单商品系统，无代码引用 |
| user_MTYdSm | 0 | ⚠️ 空数据库 | 可删除 |
| postgres | 系统 | ✅ 保留 | PostgreSQL 默认数据库 |
| template1 | 系统 | ✅ 保留 | PostgreSQL 模板数据库 |

### fsd 数据库表结构（当前系统）

#### 核心业务表
- `Site` - 站点管理（支持多站点）
- `SiteSettings` - 站点配置
- `ProductSku` - 商品 SKU
- `Order` - 订单（新架构）
- `OrderLegacy` - 旧订单备份

#### 内容管理表
- `MediaAsset` - 媒体资源（图片、视频等）
- `Review` - 用户评价
- `FloatingPurchase` - 浮动购买提示

#### 支付相关表
- `Payment` - 支付记录
- `PaymentSettings` - 支付网关配置
- `PaymentNotifyLog` - 支付回调日志

#### 管理与日志表
- `Admin` - 管理员账户
- `AdminActionLog` - 管理员操作日志
- `AdminLoginLog` - 管理员登录日志
- `OperationLog` - 业务操作日志

#### 其他表
- `OrderSnapshot` - 订单快照
- `CustomerChannel` - 客户渠道
- `ProductAsset` - 商品资源（可能与 MediaAsset 重复）
- `ProductPackage` - 商品套餐
- `ProductReview` - 商品评价（可能与 Review 重复）
- `ProductTemplate` - 商品模板

### single_item_store 数据库（旧系统）

#### 旧系统表
- `Admin`, `AdminActionLog`, `AdminLoginLog`
- `CustomerChannel`
- `Order`, `OrderSnapshot`
- `Payment`, `PaymentNotifyLog`
- `ProductAsset`, `ProductPackage`, `ProductReview`, `ProductTemplate`

**注意**：虽然表名相同，但 Order 等表的字段结构与 fsd 完全不同。

## 问题识别

### 1. 潜在重复功能的表

在 **fsd** 数据库中，存在功能可能重复的表：

#### Review vs ProductReview
- `Review` - 通用评价系统（与 Site 关联）
- `ProductReview` - 商品评价（具体字段未知）
- **需要确认**：是否可以合并？

#### MediaAsset vs ProductAsset
- `MediaAsset` - 媒体资源管理（hero、detail 等 section）
- `ProductAsset` - 商品资源（具体字段未知）
- **需要确认**：是否可以合并？

### 2. 未使用的旧数据库
- `single_item_store` - 代码中无引用
- `user_MTYdSm` - 空数据库

### 3. 缺少外键约束
根据 Prisma schema，表之间有关系但数据库中可能缺少外键约束（需验证）。

## 重构方案

### 阶段 1：数据备份（必须执行）

```bash
# 备份所有数据库
pg_dump -h 103.236.76.222 -U user_MTYdSm -d fsd -F c -f fsd_backup_$(date +%Y%m%d_%H%M%S).dump
pg_dump -h 103.236.76.222 -U user_MTYdSm -d single_item_store -F c -f single_item_store_backup_$(date +%Y%m%d_%H%M%S).dump
```

### 阶段 2：数据调查

#### 2.1 检查 fsd 中的潜在重复表

```sql
-- 检查 ProductReview 表结构和数据
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ProductReview' AND table_schema = 'public';

SELECT COUNT(*) FROM "ProductReview";

-- 检查 ProductAsset 表结构和数据
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ProductAsset' AND table_schema = 'public';

SELECT COUNT(*) FROM "ProductAsset";

-- 检查 ProductPackage 表
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ProductPackage' AND table_schema = 'public';

SELECT COUNT(*) FROM "ProductPackage";

-- 检查 ProductTemplate 表
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ProductTemplate' AND table_schema = 'public';

SELECT COUNT(*) FROM "ProductTemplate";
```

#### 2.2 检查 single_item_store 是否有需要迁移的数据

```sql
-- 检查旧系统订单数据
SELECT COUNT(*) FROM "Order";
SELECT * FROM "Order" ORDER BY "createdAt" DESC LIMIT 5;

-- 检查其他重要数据
SELECT COUNT(*) FROM "Admin";
SELECT COUNT(*) FROM "Payment";
```

### 阶段 3：决策与执行

根据调查结果，选择以下策略之一：

#### 策略 A：只清理废弃数据库（推荐，风险最低）

**适用条件**：
- single_item_store 中没有需要的数据
- fsd 中的 ProductReview、ProductAsset 等表确实在使用

**执行步骤**：
```sql
-- 删除废弃数据库
DROP DATABASE IF EXISTS single_item_store;
DROP DATABASE IF EXISTS user_MTYdSm;
```

**影响**：
- ✅ 清理冗余数据库
- ✅ 不影响当前系统
- ✅ 简化管理

#### 策略 B：清理 + 合并重复表（中等风险）

**适用条件**：
- ProductReview 和 Review 功能确实重复
- ProductAsset 和 MediaAsset 功能确实重复
- 这些表中的数据可以合并

**执行步骤**：

1. **迁移 ProductReview 到 Review**（如果 ProductReview 有数据且功能重复）
```sql
-- 检查并迁移数据
INSERT INTO "Review" (
  "siteId", "name", "content", "images", 
  "featuredOnHome", "homeOrder", "enabled", "createdAt", "updatedAt"
)
SELECT 
  1 as "siteId", -- 默认站点
  -- 其他字段映射（需要根据实际 ProductReview 结构调整）
  ...
FROM "ProductReview"
WHERE ...;

-- 验证后删除旧表
DROP TABLE "ProductReview";
```

2. **迁移 ProductAsset 到 MediaAsset**（如果功能重复）
```sql
-- 类似操作
```

3. **清理废弃数据库**
```sql
DROP DATABASE IF EXISTS single_item_store;
DROP DATABASE IF EXISTS user_MTYdSm;
```

4. **更新 Prisma schema**
```prisma
// 移除不再使用的模型
// model ProductReview { ... } // 删除
// model ProductAsset { ... }   // 删除
```

5. **生成新的 Prisma Client**
```bash
npx prisma generate
```

#### 策略 C：完整重构（高风险，仅在必要时）

**适用条件**：
- 数据结构混乱，需要彻底整理
- 有充足的测试时间

**不推荐**，除非有以下需求：
- 统一命名规范
- 优化索引和查询性能
- 添加缺失的外键约束

### 阶段 4：验证与测试

#### 4.1 数据完整性验证
```sql
-- 验证关键表的数据量
SELECT 
  'Site' as table_name, COUNT(*) as count FROM "Site"
UNION ALL
SELECT 'Order', COUNT(*) FROM "Order"
UNION ALL
SELECT 'ProductSku', COUNT(*) FROM "ProductSku"
UNION ALL
SELECT 'Review', COUNT(*) FROM "Review"
UNION ALL
SELECT 'MediaAsset', COUNT(*) FROM "MediaAsset";
```

#### 4.2 应用测试
```bash
# 运行所有测试
npm test

# 启动应用并手工测试
npm run dev
```

#### 4.3 回滚准备
```bash
# 如果出现问题，从备份恢复
pg_restore -h 103.236.76.222 -U user_MTYdSm -d fsd -c fsd_backup_YYYYMMDD_HHMMSS.dump
```

## 推荐执行方案

基于当前情况，我推荐采用 **策略 A（只清理废弃数据库）**：

### 理由：
1. ✅ 代码中完全没有使用 single_item_store
2. ✅ 风险最低，不影响现有功能
3. ✅ 执行简单，可以立即完成
4. ⚠️ fsd 中的 ProductReview/ProductAsset 等表是否真的重复需要先验证

### 延后决策：
- ProductReview vs Review 的合并 → 等确认 ProductReview 的用途
- ProductAsset vs MediaAsset 的合并 → 等确认 ProductAsset 的用途
- 如果这些表确实未使用，可以在后续单独清理

## 执行清单

- [ ] **步骤 1**：备份 fsd 数据库
- [ ] **步骤 2**：备份 single_item_store 数据库（以防万一）
- [ ] **步骤 3**：调查 fsd 中的 ProductReview、ProductAsset、ProductPackage、ProductTemplate 表
- [ ] **步骤 4**：检查 single_item_store 是否有需要的数据
- [ ] **步骤 5**：删除 user_MTYdSm 空数据库
- [ ] **步骤 6**：删除 single_item_store 数据库（确认无需要数据后）
- [ ] **步骤 7**：验证应用功能正常
- [ ] **步骤 8**：根据调查结果决定是否清理 fsd 中的冗余表

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 删除有用数据 | 🔴 高 | 完整备份 + 数据调查 |
| 应用功能异常 | 🟡 中 | 不改动 fsd 表结构 |
| 无法回滚 | 🟢 低 | 保留备份文件 |

## 附录

### A. 有用的查询

```sql
-- 查看所有数据库
SELECT datname FROM pg_database WHERE datistemplate = false;

-- 查看当前数据库的所有表
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 查看表大小
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### B. 回滚脚本

```bash
#!/bin/bash
# rollback.sh - 回滚到备份状态

BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
  echo "用法: ./rollback.sh <backup_file>"
  exit 1
fi

echo "⚠️  警告：此操作将覆盖当前数据库"
read -p "确认回滚？(yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "已取消"
  exit 0
fi

pg_restore -h 103.236.76.222 -U user_MTYdSm -d fsd -c "$BACKUP_FILE"
echo "✅ 回滚完成"
```
