-- 清理无用的数据库
-- 警告：此操作不可逆！请确保已备份重要数据

-- 删除 single_item_store 数据库（只有 3 条测试数据）
DROP DATABASE IF EXISTS single_item_store;

-- 删除 user_MTYdSm 数据库（空数据库）
DROP DATABASE IF EXISTS user_MTYdSm;

-- 验证只剩下 fsd 数据库
SELECT datname FROM pg_database WHERE datname NOT IN ('postgres', 'template0', 'template1') ORDER BY datname;
