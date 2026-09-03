#!/usr/bin/env node
/**
 * 删除无用的数据库
 * 注意：需要连接到 postgres 数据库才能删除其他数据库
 */

import pg from 'pg';

const config = {
  host: '103.236.76.222',
  port: 5432,
  user: 'user_MTYdSm',
  password: 'password_2CGeyC',
  database: 'postgres', // 连接到 postgres 数据库来删除其他数据库
};

async function main() {
  const client = new pg.Client(config);
  
  try {
    await client.connect();
    console.log('✅ 已连接到 postgres 数据库');
    
    // 删除 single_item_store 数据库
    console.log('\n删除 single_item_store 数据库...');
    // 先强制断开所有连接
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'single_item_store'
        AND pid <> pg_backend_pid()
    `);
    await client.query('DROP DATABASE IF EXISTS single_item_store');
    console.log('✅ single_item_store 数据库已删除');
    
    // 删除 user_MTYdSm 数据库
    console.log('\n删除 user_MTYdSm 数据库...');
    // 先强制断开所有连接
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'user_MTYdSm'
        AND pid <> pg_backend_pid()
    `);
    await client.query('DROP DATABASE IF EXISTS "user_MTYdSm"');
    console.log('✅ user_MTYdSm 数据库已删除');
    
    // 验证剩余数据库
    console.log('\n剩余数据库列表：');
    const result = await client.query(
      "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres', 'template0', 'template1') ORDER BY datname"
    );
    result.rows.forEach(row => console.log(`  - ${row.datname}`));
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
