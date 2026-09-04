# 项目规范

## 数据库操作规范
1. **单一数据库原则**：本项目所有 CRUD 操作有且只能操作 `fsd` 数据库
   - 不得连接或操作其他数据库（如 `single_item_store` 等）
   - 所有 Prisma 操作必须使用同一个 PrismaClient 实例
   - 环境变量 `DATABASE_URL` 必须指向 `fsd` 数据库

2. **数据同步规则**
   - SKU 数据的主存储为 `ProductSku` 表
   - `SiteSettings.productVariants` 仅在站点初始化时使用
   - 更新 SKU 时不应触发 `ensureSiteSkus` 的覆盖逻辑

## 开发规范
1. 每次改动完成后，都必须创建一个对应的 git commit，以便于后续追踪和回滚。
2. 每次改动后，都必须编写或更新相关测试，并在交付给用户前确保所有测试和验证全部通过。
3. 修复 Bug 时必须先诊断根本原因，不要只修复表面症状。
