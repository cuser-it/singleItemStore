import { PrismaClient } from '@prisma/client';

const client = new PrismaClient();

async function main() {
  console.log('Creating sequence for SiteSettings.id...');
  
  // 1. 创建序列
  await client.$executeRawUnsafe(`
    CREATE SEQUENCE IF NOT EXISTS "SiteSettings_id_seq"
  `);
  
  // 2. 设置序列的当前值为表中最大的 ID
  await client.$executeRawUnsafe(`
    SELECT setval('"SiteSettings_id_seq"', COALESCE((SELECT MAX(id) FROM "SiteSettings"), 1))
  `);
  
  // 3. 将序列设置为 id 列的默认值
  await client.$executeRawUnsafe(`
    ALTER TABLE "SiteSettings" 
    ALTER COLUMN id SET DEFAULT nextval('"SiteSettings_id_seq"')
  `);
  
  // 4. 将序列的所有权分配给列
  await client.$executeRawUnsafe(`
    ALTER SEQUENCE "SiteSettings_id_seq" OWNED BY "SiteSettings".id
  `);
  
  console.log('✅ SiteSettings sequence created and configured successfully!');
  
  // 验证
  const result = await client.$queryRaw`SELECT pg_get_serial_sequence('"SiteSettings"', 'id') as sequence_name`;
  console.log('Sequence name:', result);
  
  const lastValue = await client.$queryRaw`SELECT last_value FROM "SiteSettings_id_seq"`;
  console.log('Sequence last_value:', lastValue);
  
  await client.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
