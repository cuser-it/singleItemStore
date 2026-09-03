import { PrismaClient } from '@prisma/client';

const client = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:postgres@localhost:5432/fsd' } } });

async function main() {
  // 检查序列值
  const seqResult = await client.$queryRaw`SELECT last_value FROM "SiteSettings_id_seq"`;
  console.log('SiteSettings sequence last_value:', seqResult);
  
  // 检查最大 ID
  const maxResult = await client.$queryRaw`SELECT MAX(id) as max_id FROM "SiteSettings"`;
  console.log('SiteSettings MAX(id):', maxResult);
  
  await client.$disconnect();
}

main().catch(console.error);
