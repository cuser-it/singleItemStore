import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPriceInconsistency() {
  console.log('开始修复价格不一致问题...\n');

  // 获取所有站点的设置
  const allSettings = await prisma.siteSettings.findMany({
    include: {
      site: true,
    },
  });

  let totalFixed = 0;

  for (const settings of allSettings) {
    const variants = settings.productVariants as any[];
    if (!variants || variants.length === 0) {
      console.log(`⏭️  站点 ${settings.siteId} (${settings.site.name}): 没有 productVariants，跳过`);
      continue;
    }

    console.log(`\n检查站点 ${settings.siteId} (${settings.site.name})...`);

    for (const variant of variants) {
      if (!variant.id || variant.price === undefined) continue;

      // 查找对应的 ProductSku
      const sku = await prisma.productSku.findFirst({
        where: {
          siteId: settings.siteId,
          skuCode: variant.id,
        },
      });

      if (!sku) {
        console.log(`  ⚠️  未找到 skuCode="${variant.id}" 的 ProductSku`);
        continue;
      }

      const skuPrice = Number(sku.price);
      const variantPrice = Number(variant.price);

      if (skuPrice !== variantPrice) {
        console.log(`  🔧 修复 SKU ${sku.id} (${variant.id}): ${skuPrice} → ${variantPrice}`);
        
        // 更新 ProductSku
        await prisma.productSku.update({
          where: { id: sku.id },
          data: {
            price: variantPrice,
            originalPrice: variant.originalPrice,
            name: variant.name,
            subtitle: variant.subtitle,
            saleLabel: variant.saleLabel,
            highlight: variant.highlight,
            updatedAt: new Date(),
          },
        });
        
        totalFixed++;
      } else {
        console.log(`  ✅ SKU ${sku.id} (${variant.id}): 价格一致 (${variantPrice})`);
      }
    }
  }

  console.log(`\n✅ 修复完成！共修复 ${totalFixed} 个不一致的 SKU`);
}

fixPriceInconsistency()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
