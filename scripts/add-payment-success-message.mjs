import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: '103.236.76.222',
  port: 5432,
  database: 'fsd',
  user: 'user_MTYdSm',
  password: 'password_2CGeyC',
});

async function addPaymentSuccessMessage() {
  try {
    await client.connect();
    console.log('✅ 已连接到数据库');

    // 检查字段是否已存在
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'SiteSettings' 
      AND column_name = 'paymentSuccessMessage'
    `);

    if (checkResult.rows.length > 0) {
      console.log('ℹ️  字段 paymentSuccessMessage 已存在');
    } else {
      // 添加字段
      await client.query(`
        ALTER TABLE "SiteSettings" 
        ADD COLUMN "paymentSuccessMessage" text NOT NULL DEFAULT '添加客服领取服用说明'
      `);
      console.log('✅ 已添加字段 paymentSuccessMessage');
    }

    // 验证字段已添加
    const verifyResult = await client.query(`
      SELECT "paymentSuccessMessage" 
      FROM "SiteSettings" 
      LIMIT 1
    `);
    console.log('✅ 验证成功，当前默认值:', verifyResult.rows[0]?.paymentSuccessMessage);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

addPaymentSuccessMessage();
