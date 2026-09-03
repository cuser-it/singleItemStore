# 数据库重构指南

## 📋 概述

本项目的数据库经过分析后发现存在冗余结构，需要进行清理和重构。

## 🔍 问题总结

1. **存在多个数据库**
   - `fsd` - 当前使用的主数据库 ✅
   - `single_item_store` - 旧系统，几乎为空 ⚠️
   - `user_MTYdSm` - 完全空的数据库 ⚠️

2. **fsd 数据库中混合了两套系统的表**
   - 新系统：基于 Site 的多站点架构（使用中）
   - 旧系统：基于 ProductTemplate 的单商品模板架构（遗留）

## 📊 详细分析

查看完整分析报告：[database-analysis-result.md](./database-analysis-result.md)

## 🚀 快速执行

### 方案 1：自动清理脚本（推荐）

```bash
# 执行清理脚本（会提示确认）
./scripts/cleanup-databases.sh
```

**此脚本会：**
1. ✅ 自动备份所有数据库
2. ✅ 删除 `user_MTYdSm` 空数据库
3. ✅ 删除 `single_item_store` 旧数据库
4. ✅ 删除 fsd 中的空表（ProductAsset, ProductReview）
5. ✅ 验证清理结果

### 方案 2：手动执行

如果你想手动控制每一步，参考 [database-refactoring-plan.md](./database-refactoring-plan.md)

## 📝 执行清单

执行前请确认：

- [ ] 已阅读分析报告 `database-analysis-result.md`
- [ ] 已了解将要删除的内容
- [ ] 已确认 single_item_store 中无重要数据
- [ ] 应用当前运行正常

执行清理：

- [ ] 运行 `./scripts/cleanup-databases.sh`
- [ ] 确认备份文件已创建
- [ ] 确认删除操作成功
- [ ] 验证应用功能正常

后续处理：

- [ ] 检查 ProductPackage 表（3条数据）
- [ ] 检查 ProductTemplate 表（1条数据）
- [ ] 决定是否需要进一步清理旧系统表
- [ ] 运行测试：`npm test`
- [ ] 更新 Prisma schema（如需要）

## 🔐 安全措施

1. **自动备份**
   - 所有操作前都会自动备份到 `backups/` 目录
   - 备份文件格式：`<database>_backup_YYYYMMDD_HHMMSS.dump`

2. **手动确认**
   - 脚本会显示将要删除的内容
   - 必须输入 `yes` 才会执行删除操作

3. **可回滚**
   - 如果出现问题，可以使用备份文件恢复

## 🔄 回滚操作

如果清理后出现问题，可以使用备份恢复：

```bash
# 恢复 fsd 数据库
PGPASSWORD=password_2CGeyC pg_restore -h 103.236.76.222 -U user_MTYdSm -d fsd -c backups/fsd_backup_YYYYMMDD_HHMMSS.dump

# 恢复 single_item_store 数据库（如需要）
PGPASSWORD=password_2CGeyC pg_restore -h 103.236.76.222 -U user_MTYdSm -d postgres -c backups/single_item_store_backup_YYYYMMDD_HHMMSS.dump
```

## 📁 相关文档

- [database-refactoring-plan.md](./database-refactoring-plan.md) - 完整的重构计划
- [database-analysis-result.md](./database-analysis-result.md) - 详细的分析结果

## ⚠️ 注意事项

1. **在生产环境执行前**
   - 在开发/测试环境先执行一遍
   - 确认应用功能完全正常
   - 通知团队成员

2. **执行时机**
   - 选择低峰期执行
   - 确保有足够时间验证和回滚

3. **后续工作**
   - 清理完成后，仍需要评估 ProductPackage 和 ProductTemplate 表
   - 可能需要更新 Prisma schema
   - 建议运行完整的测试套件

## 📞 问题反馈

如果执行过程中遇到问题，请检查：

1. 备份文件是否创建成功
2. 数据库连接是否正常
3. 是否有足够的权限执行删除操作

如果需要回滚，请立即使用备份文件恢复。
