# 价格数据源重构计划

## 🎯 目标
将价格存储从 3 个数据源简化为 1 个：**ProductSku 表**

## 📊 当前问题
1. **ProductSku.price** - 真实的 SKU 价格
2. **SiteSettings.salePrice** - 冗余字段（用于显示"当前售价"）
3. **SiteSettings.productVariants** - JSON 冗余字段（历史遗留）

### 问题表现
- 修改 SKU 价格后需要同步 3 个地方
- 项目重启时可能数据不一致
- 维护成本高，容易出 bug

## 🔄 重构策略

### 阶段 1：迁移读取逻辑（兼容性优先）
**不删除字段，先改读取逻辑**

1. **前端显示价格**
   - 当前：从 `settings.salePrice` 读取
   - 改为：从 `bootstrap.skus[0].price` 读取
   
2. **订单创建**
   - 当前：已经从 ProductSku 读取 ✅
   - 无需修改

3. **Bootstrap 接口**
   - 当前：返回 settings.salePrice 和 settings.productVariants
   - 改为：只返回 skus，前端从 skus 中获取价格

### 阶段 2：移除写入逻辑
1. 删除 `updateSiteSettings` 中的价格同步逻辑
2. 删除 `updateSku` 中向 SiteSettings 同步的代码
3. 后台设置表单移除价格输入框（价格只能在 SKU 管理中修改）

### 阶段 3：数据库迁移（可选）
**创建数据库迁移脚本，删除冗余字段**
```sql
ALTER TABLE "SiteSettings" 
  DROP COLUMN "salePrice",
  DROP COLUMN "originalPrice",
  DROP COLUMN "productVariants";
```

## 📝 实施步骤

### Step 1: 修改前端读取逻辑
- [ ] `src/App.tsx` - 从 skus 读取价格，而非 settings.salePrice
- [ ] 确保所有显示价格的地方都改用 skus

### Step 2: 简化后端逻辑
- [ ] `server/orders.ts` - 移除 updateSku 中的同步代码
- [ ] `server/prismaStore.ts` - 移除 updateSiteSettings 中的价格同步
- [ ] `server/app.ts` - 后台设置接口移除价格字段

### Step 3: 更新类型定义
- [ ] `shared/site.ts` - 标记 salePrice/productVariants 为 deprecated
- [ ] 或直接删除这些字段

### Step 4: 数据库迁移（可选）
- [ ] 创建迁移脚本
- [ ] 备份数据
- [ ] 执行迁移
- [ ] 更新 Prisma schema

## ⚠️ 风险评估

### 低风险（推荐先做）
✅ 修改前端读取逻辑 - 不影响数据库
✅ 移除同步逻辑 - 简化代码

### 中风险（谨慎操作）
⚠️ 删除数据库字段 - 需要备份和回滚方案

## 🚀 推荐方案

**分两个 PR 完成：**

### PR 1: 逻辑重构（今天完成）
1. 修改所有读取价格的地方，从 ProductSku 读取
2. 移除同步逻辑
3. 保留数据库字段（向后兼容）
4. 充分测试

### PR 2: 数据库清理（1-2 周后）
1. 确认 PR 1 稳定运行
2. 创建数据库迁移脚本
3. 删除冗余字段
4. 更新 Prisma schema

## ✅ 验收标准

1. 修改 SKU 价格后，所有展示价格的地方立即生效
2. 项目重启后，价格不会变化
3. 不需要任何"同步"代码
4. 代码更简单，更容易维护
