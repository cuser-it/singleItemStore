-- 将支付配置改为全局唯一（不再按站点存储）

-- 1. 如果有多个站点的支付配置，保留活动站点的配置（或 ID 最小的）
-- 2. 删除外键约束
-- 3. 删除 siteId 列
-- 4. 删除多余的配置记录，只保留一条

-- 保留一条配置记录（优先保留活动站点的，否则保留 ID 最小的）
DO $$
DECLARE
    keep_id INT;
BEGIN
    -- 找到要保留的配置 ID（活动站点的配置，或者 ID 最小的）
    SELECT ps.id INTO keep_id
    FROM "PaymentSettings" ps
    LEFT JOIN "Site" s ON ps."siteId" = s.id
    ORDER BY s."isActive" DESC NULLS LAST, ps.id ASC
    LIMIT 1;
    
    -- 删除其他配置
    IF keep_id IS NOT NULL THEN
        DELETE FROM "PaymentSettings" WHERE id != keep_id;
    END IF;
END $$;

-- 删除外键约束
ALTER TABLE "PaymentSettings" DROP CONSTRAINT IF EXISTS "PaymentSettings_siteId_fkey";

-- 删除 siteId 列
ALTER TABLE "PaymentSettings" DROP COLUMN IF EXISTS "siteId";
