-- 清理孤立的数据
-- 这些数据对应的站点已被删除，但关联数据未被级联删除

-- 1. 清理孤立的 SiteSettings
DELETE FROM "SiteSettings" WHERE "siteId" NOT IN (SELECT id FROM "Site");

-- 2. 清理孤立的 MediaAsset
DELETE FROM "MediaAsset" WHERE "siteId" NOT IN (SELECT id FROM "Site");

-- 3. 清理孤立的 Review
DELETE FROM "Review" WHERE "siteId" NOT IN (SELECT id FROM "Site");

-- 4. 清理孤立的 FloatingPurchase
DELETE FROM "FloatingPurchase" WHERE "siteId" NOT IN (SELECT id FROM "Site");

-- 5. 清理孤立的 ProductSku
DELETE FROM "ProductSku" WHERE "siteId" NOT IN (SELECT id FROM "Site");

-- 6. 清理孤立的 PaymentSettings
DELETE FROM "PaymentSettings" WHERE "siteId" NOT IN (SELECT id FROM "Site");

-- 7. 清理孤立的 OperationLog
DELETE FROM "OperationLog" WHERE "siteId" NOT IN (SELECT id FROM "Site");
