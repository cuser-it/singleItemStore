# 价格数据源重构总结

## 执行时间
2026-09-03

## 重构目标 ✅
将价格存储从 3 个冗余数据源简化为 1 个单一数据源（ProductSku 表）

## 完成的变更

### 1. 数据库 Schema 变更 ✅
**文件：** `prisma/schema.prisma`

删除了 SiteSettings 模型中的 3 个冗余字段：
- ❌ `salePrice: Float`
- ❌ `originalPrice: Float` 
- ❌ `productVariants: Json`

### 2. 类型定义变更 ✅
**文件：** `shared/site.ts`

从 `SiteSettings` 接口中删除：
- `salePrice`
- `originalPrice`
- `productVariants`

### 3. 前端变更 ✅
**文件：** `src/App.tsx`

#### 删除的功能：
- 后台仪表板中的"当前售价"和"原价"显示
- 后台设置表单中的价格输入字段（salePrice, originalPrice）

#### 修改的逻辑：
- 所有价格显示改为从 `bootstrap.skus` 读取
- 不再有 `settings.salePrice` 或 `settings.productVariants` 的引用

### 4. 后端同步逻辑删除 ✅

#### `server/orders.ts`
删除了 `updateSku` 函数中的价格同步代码（第 515-544 行）：
- 不再将 SKU 价格同步到 `SiteSettings.productVariants`
- 修改 SKU 价格后立即生效，无需额外同步

简化了 `ensureSiteSkus` 初始化逻辑：
- 移除了从 `settings.productVariants` 读取的备选逻辑
- 现在只使用硬编码默认值初始化新站点

#### `server/prismaStore.ts`
删除了 `updateSiteSettings` 中的价格同步代码（第 570-590 行）：
- 不再将 `settings.productVariants` 的价格同步到 `ProductSku` 表
- 设置接口不再处理价格字段

### 5. 后端接口变更 ✅

#### `/api/public/bootstrap`
- 已经正确返回 `skus` 数组
- `settings` 对象不再包含价格字段

#### `/api/admin/site-settings`
- `buildSettingsInput` 函数已经不接受价格字段
- 请求和响应都不再包含 `salePrice`、`originalPrice`、`productVariants`

### 6. 数据库迁移脚本 ✅
**新文件：** `scripts/migrate-remove-price-fields.mjs`

功能：
- 备份当前数据
- 验证 ProductSku 表有完整数据
- 删除 SiteSettings 的冗余字段
- 重新生成 Prisma 客户端

## 验证结果 ✅

### 编译检查
- ✅ TypeScript 编译通过（`npx tsc --noEmit`）
- ✅ Vite 构建成功（`npx vite build`）

### 测试结果
- ✅ 所有测试通过（5/5 tests passed）

### 代码质量
- ✅ 删除约 100 行冗余同步逻辑
- ✅ 简化数据流，降低维护复杂度
- ✅ 消除价格不一致的根本原因

## Git 提交
```
commit 36dc6df
refactor!: 重构价格存储为单一数据源架构

7 files changed, 129 insertions(+), 131 deletions(-)
```

## 下一步操作（需要手工执行）

### 1. 在测试环境验证 ⚠️
```bash
# 1. 确保当前数据库有备份
pg_dump -U postgres fsd > backup_before_migration.sql

# 2. 运行迁移脚本
node scripts/migrate-remove-price-fields.mjs

# 3. 启动服务器
npm start

# 4. 验证功能
# - 访问前台，检查商品价格显示
# - 登录后台，修改 SKU 价格
# - 确认价格修改立即生效
# - 重启服务器，确认价格保持不变
```

### 2. 生产环境部署 ⚠️
```bash
# 1. 完整备份生产数据库
pg_dump -U postgres fsd > production_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 部署新代码
git pull
npm install
npm run build

# 3. 执行数据库迁移
node scripts/migrate-remove-price-fields.mjs

# 4. 重启服务
pm2 restart all  # 或你的进程管理器

# 5. 监控日志和错误
pm2 logs --lines 100
```

### 3. 回滚方案（如果出现问题）
```bash
# 1. 恢复数据库
psql -U postgres fsd < backup_before_migration.sql

# 2. 回滚代码
git revert 36dc6df

# 3. 重新生成 Prisma 客户端
npx prisma generate

# 4. 重新构建和重启
npm run build
pm2 restart all
```

## 预期效果

### 用户体验
- ✅ 修改 SKU 价格后立即生效，无延迟
- ✅ 项目重启后价格永远不会变化
- ✅ 后台设置页面更简洁（价格管理集中在 SKU 管理）

### 开发体验
- ✅ 代码更简单，易于理解和维护
- ✅ 不再有价格同步的复杂逻辑
- ✅ 减少潜在的数据一致性问题

### 系统性能
- ✅ 减少数据库字段，减少存储空间
- ✅ 减少同步查询，略微提升性能
- ✅ Bootstrap 接口返回数据更小

## 风险评估

### 高风险 ⚠️
- **数据库字段删除是不可逆操作**
  - 缓解措施：完整备份 + 先在测试环境验证

### 中风险 ⚠️
- **前端读取逻辑变更**
  - 缓解措施：已添加空值检查和默认值

### 低风险 ✅
- **删除同步代码**
  - TypeScript 类型检查已确保没有遗漏的引用

## 注意事项

1. **BREAKING CHANGE**：此重构不向后兼容
   - 旧版本代码无法使用新数据库结构
   - 必须同步部署前后端

2. **部署顺序**：代码部署 → 数据库迁移 → 服务重启
   - 顺序错误可能导致服务中断

3. **监控要点**：
   - 价格显示是否正确
   - SKU 修改接口是否正常工作
   - 订单创建是否使用正确的价格

4. **历史订单不受影响**：
   - 已创建的订单价格保持不变
   - 只有新订单使用 ProductSku 的当前价格

## 相关文件

### 修改的文件
- `prisma/schema.prisma` - 数据库 schema
- `shared/site.ts` - 类型定义
- `src/App.tsx` - 前端 UI
- `server/app.ts` - 后端路由（无实质变更，类型自动调整）
- `server/orders.ts` - 删除同步逻辑
- `server/prismaStore.ts` - 删除同步逻辑

### 新增的文件
- `scripts/migrate-remove-price-fields.mjs` - 数据库迁移脚本

### 待删除的文件（可选）
- `scripts/test-price-persistence.mjs` - 测试价格持久化（已不适用）
- `scripts/test-sku-sync.mjs` - 测试 SKU 同步（已不需要）

## 结论

✅ **重构已完成**，所有代码变更已提交到 Git。

⚠️ **待执行**：数据库迁移脚本需要在测试环境和生产环境分别手工执行。

📋 **建议**：在生产环境部署前，在测试环境完整验证所有场景。
