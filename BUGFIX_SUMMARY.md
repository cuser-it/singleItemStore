# Bug 修复总结

## 问题分析

### 问题 1：更新商品规格价格后，前端显示还是 99 元

**根本原因分析：**
通过数据库检查，我发现 ProductSku 表中的价格**已经正确更新**为 66.00。这说明后端的 SKU 同步逻辑是正常工作的。

用户看到的"还是 99 元"问题可能来自以下几个方面：
1. **字段混淆**：SiteSettings 表中有两个价格字段：
   - `salePrice`：站点级别的默认售价（99.0）
   - `productVariants[0].price`：第一个商品规格的价格（66）
   
   如果前端显示的是 `salePrice` 而不是 `productVariants[0].price`，就会看到 99 元。

2. **前端缓存**：浏览器或应用层缓存了旧数据。

3. **多个价格字段未同步**：`salePrice`、`originalPrice` 和 `productVariants` 中的价格应该保持一致，但目前可能不同步。

**数据库验证：**
```
站点 1 的 SiteSettings：
- salePrice: 99.0（未更新）
- productVariants[0].price: 66（已更新）

站点 1 的 ProductSku：
- price: 66.00（已正确同步）
```

### 问题 2：复制默认站点时，使用初始化数据而不是当前数据

**根本原因：**
数据库中存在孤立的 SiteSettings 数据（siteId=2），这是因为：
1. 站点 2 已被删除，但其关联的 SiteSettings 记录未被级联删除
2. 虽然 Prisma schema 中配置了 `onDelete: Cascade`，但数据库外键约束可能未正确应用

**问题数据：**
```
SiteSettings id=2, siteId=2：孤立记录（站点 2 已删除）
- shopName: "测试"
- price: 99
- 创建时间：2026-09-02 09:07:59.133
```

**潜在风险：**
- `nextSettingsId()` 可能返回已存在的 ID（如 2、3、4）
- 插入新 SiteSettings 时可能因主键冲突而失败
- 或者使用了旧的孤立数据

## 已完成的修复

### 1. 改进 `duplicateSiteContent` 函数

**修改位置：** `server/prismaStore.ts:366-446`

**改进内容：**
1. 添加了明确的 null 检查
2. 当模板站点没有设置时，记录错误日志
3. 添加详细的复制日志，显示源站点信息
4. 添加复制完成的统计日志

**代码改进：**
```typescript
if (!templateSettings) {
  console.error(`[duplicateSiteContent] Template site ${templateSiteId} has no settings, using default settings`);
  // ... 使用默认设置
  return;
}

console.log(`[duplicateSiteContent] Copying from site ${templateSiteId} (${templateSettings.shopName}) to site ${newSiteId}`);
// ... 复制逻辑
console.log(`[duplicateSiteContent] Successfully copied site content: ${mediaAssets.length} media assets, ${reviews.length} reviews, ${floatingPurchases.length} floating purchases`);
```

## 待执行的修复

### 1. 清理数据库中的孤立数据

**SQL 脚本：** `prisma/cleanup-orphaned-data.sql`

需要手动执行以下命令：
```bash
psql -h localhost -U postgres -d fsd -f prisma/cleanup-orphaned-data.sql
```

或者在数据库客户端中执行该文件中的 SQL 语句。

### 2. 验证并重新应用数据库外键约束

检查数据库中是否正确创建了外键约束：
```sql
SELECT conname, conrelid::regclass, confrelid::regclass, contype
FROM pg_constraint
WHERE confrelid::regclass::text = 'Site';
```

如果外键约束缺失，需要运行：
```bash
npx prisma db push --force-reset
```
**警告：这会清空数据库！** 在生产环境中应该使用迁移。

### 3. 建议：统一价格字段更新逻辑

当更新 `productVariants` 中的价格时，自动同步更新 `salePrice` 字段。

**实现方案：**
在 `updateSiteSettings` 中添加逻辑：
```typescript
// 如果 productVariants 有变化，自动更新 salePrice 为第一个规格的价格
if (input.productVariants && input.productVariants.length > 0) {
  input.salePrice = input.productVariants[0].price;
  input.originalPrice = input.productVariants[0].originalPrice;
}
```

## 验证步骤

### 验证问题 1 修复：
1. 清理孤立数据后，删除站点 3 或 4
2. 检查数据库，确认 SiteSettings 等关联数据也被删除
3. 如果未删除，说明外键约束未生效，需要重新应用

### 验证问题 2 修复：
1. 修改默认站点的商品价格为特殊值（如 888）
2. 创建新站点，选择"复制默认站点"
3. 检查新站点的价格是否为 888
4. 检查日志，应该看到类似信息：
   ```
   [duplicateSiteContent] Copying from site 1 (已修改的店铺名称_Prisma) to site 5
   [duplicateSiteContent] Successfully copied site content: X media assets, Y reviews, Z floating purchases
   ```

## 后续建议

1. **添加集成测试**：测试删除站点时关联数据是否正确删除
2. **添加数据一致性检查**：定期检查孤立数据
3. **前端缓存策略**：更新站点设置后，强制刷新页面或清除缓存
4. **价格字段统一**：考虑是否需要 `salePrice` 和 `productVariants[0].price` 两个字段，或者确保它们始终同步
