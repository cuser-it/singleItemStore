#!/bin/bash

# 数据库清理脚本
# 用途：清理废弃的数据库和空表
# 风险等级：中等（已备份数据）

set -e  # 遇到错误立即退出

# 配置
DB_HOST="103.236.76.222"
DB_USER="user_MTYdSm"
DB_PASSWORD="password_2CGeyC"
DB_NAME="fsd"
BACKUP_DIR="/mnt/d/wsl/code/singleItemStore/backups"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}数据库清理脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查 PostgreSQL 客户端工具
if ! command -v psql &> /dev/null; then
    echo -e "${RED}错误：未找到 psql 命令${NC}"
    echo "请安装 PostgreSQL 客户端工具："
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  macOS: brew install postgresql"
    exit 1
fi

if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}错误：未找到 pg_dump 命令${NC}"
    exit 1
fi

# 创建备份目录
echo -e "${YELLOW}步骤 1/5: 创建备份目录${NC}"
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓ 备份目录创建完成: $BACKUP_DIR${NC}"
echo ""

# 备份 fsd 数据库
echo -e "${YELLOW}步骤 2/5: 备份 fsd 数据库${NC}"
BACKUP_FILE_FSD="$BACKUP_DIR/fsd_backup_$(date +%Y%m%d_%H%M%S).dump"
echo "备份文件: $BACKUP_FILE_FSD"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" -d fsd -F c -f "$BACKUP_FILE_FSD"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ fsd 数据库备份完成${NC}"
    ls -lh "$BACKUP_FILE_FSD"
else
    echo -e "${RED}✗ 备份失败${NC}"
    exit 1
fi
echo ""

# 备份 single_item_store 数据库
echo -e "${YELLOW}步骤 3/5: 备份 single_item_store 数据库${NC}"
BACKUP_FILE_OLD="$BACKUP_DIR/single_item_store_backup_$(date +%Y%m%d_%H%M%S).dump"
echo "备份文件: $BACKUP_FILE_OLD"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" -d single_item_store -F c -f "$BACKUP_FILE_OLD"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ single_item_store 数据库备份完成${NC}"
    ls -lh "$BACKUP_FILE_OLD"
else
    echo -e "${RED}✗ 备份失败${NC}"
    exit 1
fi
echo ""

# 确认删除
echo -e "${YELLOW}步骤 4/5: 确认删除操作${NC}"
echo -e "${RED}警告：即将执行以下删除操作：${NC}"
echo "  1. 删除数据库: user_MTYdSm (空数据库)"
echo "  2. 删除数据库: single_item_store (旧系统)"
echo "  3. 删除 fsd 中的空表: ProductAsset, ProductReview"
echo ""
echo -e "${YELLOW}所有数据已备份到: $BACKUP_DIR${NC}"
echo ""
read -p "确认执行删除操作？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}操作已取消${NC}"
    exit 0
fi
echo ""

# 执行删除操作
echo -e "${YELLOW}步骤 5/5: 执行删除操作${NC}"
echo ""

# 删除空数据库 user_MTYdSm
echo "5.1 删除空数据库 user_MTYdSm..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS user_MTYdSm;" 2>/dev/null || true
echo -e "${GREEN}✓ user_MTYdSm 数据库已删除${NC}"
echo ""

# 删除旧系统数据库 single_item_store
echo "5.2 删除旧系统数据库 single_item_store..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS single_item_store;" 2>/dev/null || true
echo -e "${GREEN}✓ single_item_store 数据库已删除${NC}"
echo ""

# 删除 fsd 中的空表
echo "5.3 删除 fsd 中的空表..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d fsd <<EOF
DROP TABLE IF EXISTS "ProductAsset" CASCADE;
DROP TABLE IF EXISTS "ProductReview" CASCADE;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 空表已删除 (ProductAsset, ProductReview)${NC}"
else
    echo -e "${RED}✗ 删除表失败${NC}"
    exit 1
fi
echo ""

# 验证结果
echo -e "${YELLOW}验证清理结果...${NC}"
echo ""
echo "剩余数据库:"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -t -c "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;"
echo ""

echo "fsd 数据库中的表:"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d fsd -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
echo ""

# 完成
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 数据库清理完成${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "备份文件位置:"
echo "  - $BACKUP_FILE_FSD"
echo "  - $BACKUP_FILE_OLD"
echo ""
echo "已删除:"
echo "  ✓ 数据库: user_MTYdSm"
echo "  ✓ 数据库: single_item_store"
echo "  ✓ 表: ProductAsset"
echo "  ✓ 表: ProductReview"
echo ""
echo -e "${YELLOW}下一步建议:${NC}"
echo "  1. 运行应用测试: npm test"
echo "  2. 检查 ProductPackage 和 ProductTemplate 表"
echo "  3. 查看分析报告: docs/database-analysis-result.md"
echo ""
